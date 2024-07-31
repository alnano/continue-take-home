import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import fetch from "node-fetch";
import semver from "semver";
import { dirname, join, resolve } from "path";
import { extract } from "tar";
//file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const nodeModulesPath = join(rootDir, "node_modules");
const validCommmands = { add: true, install: true };
const args = process.argv.slice(2);
const command = args[0];
const packageName = args[1];
const getVersion = (packageInput) => {
    const versionNumber = packageInput.match(/@(.+)/);
    return versionNumber ? versionNumber[1] : "";
};
const filePath = "./package.json";
async function fetchPackageMetadata(packageName, version = false) {
    const url = version
        ? `https://registry.npmjs.org/${packageName}/${version}`
        : `https://registry.npmjs.org/${packageName}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const metadata = (await response.json());
    return metadata;
}
const writeToPackageJson = async (jsonData, packageNme, packageVersion) => {
    const newJsonData = {
        ...jsonData,
        dependencies: {
            ...jsonData.dependencies,
            [packageNme]: packageVersion,
        },
    };
    const jsonString = JSON.stringify(newJsonData, null, 2);
    await fs.writeFile(filePath, jsonString);
};
const addDependecies = async (inputedPackageName) => {
    const strippedVersionNumber = getVersion(inputedPackageName);
    const cleanedInput = strippedVersionNumber
        ? inputedPackageName.split("@")[0]
        : inputedPackageName;
    const packageResponse = await fetchPackageMetadata(cleanedInput, strippedVersionNumber);
    const packageNme = packageResponse.name;
    const packageVersion = strippedVersionNumber
        ? strippedVersionNumber
        : packageResponse["dist-tags"]["latest"];
    try {
        const data = await fs.readFile(filePath, "utf8");
        const jsonData = JSON.parse(data);
        await writeToPackageJson(jsonData, packageNme, packageVersion);
    }
    catch (err) {
        console.error(err);
    }
};
const getDependencies = async () => {
    const dependenciesList = [];
    try {
        const data = await fs.readFile("package.json");
        const dataJson = JSON.parse(data.toString());
        for (const key in dataJson.dependencies) {
            dependenciesList.push({ [key]: dataJson.dependencies[key] });
        }
        return dependenciesList;
    }
    catch (err) {
        console.error("Error reading/parsing package.json", err);
        return [];
    }
};
const fetchPackageJson = async (packageName, versionRange) => {
    const metadata = await fetchPackageMetadata(packageName);
    if (!metadata) {
        return null;
    }
    const strippedVersion = getVersion(versionRange)
        ? getVersion(versionRange)
        : versionRange;
    const version = semver.maxSatisfying(Object.keys(metadata.versions), strippedVersion);
    if (!version) {
        throw new Error(`No satisfying version found for ${packageName} with range ${strippedVersion}`);
    }
    return metadata.versions[version];
};
const downloadAndExtractTarball = async (tarballUrl, packageName) => {
    const tarballPath = join(rootDir, packageName + ".tgz");
    // Ensure node_modules directory exists
    const createNodeModuleFolder = packageName;
    const targetPath = join(nodeModulesPath, createNodeModuleFolder);
    await fs.mkdir(targetPath, { recursive: true });
    // Ensure parent directories exist for tarball path
    const tarballDir = dirname(tarballPath);
    await fs.mkdir(tarballDir, { recursive: true });
    console.log(`Downloading tarball from: ${tarballUrl}`);
    console.log(`Tarball will be saved to: ${tarballPath}`);
    console.log(`Extracting to: ${nodeModulesPath}`);
    const response = await fetch(tarballUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${tarballUrl}: ${response.statusText}`);
    }
    // Write the tarball to a file using arrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer
    await fs.writeFile(tarballPath, buffer);
    console.log(`Tarball downloaded and saved to: ${tarballPath}`);
    // Verify the tarball file exists
    const fileExists = await fs
        .access(tarballPath)
        .then(() => true)
        .catch(() => false);
    if (!fileExists) {
        throw new Error(`Tarball file not found at: ${tarballPath}`);
    }
    // Extract the tarball to the node_modules directory
    try {
        await extract({
            file: tarballPath,
            cwd: targetPath,
        });
        console.log(`Tarball extracted to: ${nodeModulesPath}`);
    }
    catch (error) {
        throw new Error(`Failed to error ${error}`);
    }
    // Clean up the tarball file
    await fs.unlink(tarballPath);
    console.log(`Tarball file removed: ${tarballPath}`);
    // Verify extraction by listing files
    const extractedFiles = await fs.readdir(nodeModulesPath);
    console.log(`Files extracted to ${nodeModulesPath}:`, extractedFiles);
};
const valdiateVersion = (version) => {
    //Hacky way of handling cases like "string-width-cjs": "npm:string-width@^4.2.0".
    //"string-width-cjs" is an entirely different package; it should defer to "npm:string-width@^4.2.0".
    const strippedVersion = version.match(/npm:(.+)/);
    if (strippedVersion) {
        const versList = strippedVersion[1].match(/^([^@]+)@(.+)$/);
        return versList ? [versList[1], versList[2]] : false;
    }
    else {
        return false;
    }
};
const getDependenciesRecursively = async (initialDependencies) => {
    const allDependencies = {};
    async function addDependencies(dependencies) {
        for (const dep of dependencies) {
            let [name, versionRange] = Object.entries(dep)[0];
            // sanity versionName
            const validatedVersions = valdiateVersion(versionRange);
            if (validatedVersions) {
                name = validatedVersions[0];
                versionRange = validatedVersions[1];
            }
            if (!allDependencies[name]) {
                const packageJson = await fetchPackageJson(name, versionRange);
                if (packageJson) {
                    allDependencies[name] = packageJson;
                    await downloadAndExtractTarball(packageJson.dist.tarball, name);
                    if (packageJson.dependencies) {
                        const subDependencies = Object.entries(packageJson.dependencies).map(([key, value]) => ({ [key]: value }));
                        await addDependencies(subDependencies);
                    }
                }
            }
        }
    }
    await addDependencies(initialDependencies);
    return Object.values(allDependencies);
};
//add is-thirteen
if (command in validCommmands && command === "add") {
    addDependecies(packageName);
}
//install
if (command in validCommmands && command == "install") {
    (async () => {
        try {
            const dependenciesList = await getDependencies();
            await getDependenciesRecursively(dependenciesList);
        }
        catch (err) {
            console.error(err);
        }
    })();
}
