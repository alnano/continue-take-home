"use strict";
// import { promises } from "dns";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
// const fs = require('fs').promises;
const node_fetch_1 = __importDefault(require("node-fetch"));
const semver_1 = __importDefault(require("semver"));
// const fetch = require('node-fetch')
// const semver = require('semver');
// todo
//[x]init pckJson file
//[x]write to pckJson file
//[x]fetch data from registry
//[x]recurse on dependencies
//[x]install to node_modules
//[]edge cases?
//[]tests
const validCommmands = { "add": true, "install": true };
const args = process.argv.slice(2);
const command = args[0];
const packageName = args[1];
const getVersion = (packageInput) => {
    const versionNumber = packageInput.match(/@(.+)/);
    return versionNumber ? versionNumber[1] : false;
};
function fetchPackageMetadata(packageName_1) {
    return __awaiter(this, arguments, void 0, function* (packageName, version = false) {
        // const url = `https://registry.npmjs.org/${packageName}`;
        const url = version ? `https://registry.npmjs.org/${packageName}/${version}` : `https://registry.npmjs.org/${packageName}`;
        const response = yield (0, node_fetch_1.default)(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const metadata = yield response.json();
        return metadata;
    });
}
const writeToPackageJson = (jsonData, packageNme, packageVersion) => __awaiter(void 0, void 0, void 0, function* () {
    const newJsonData = Object.assign(Object.assign({}, jsonData), { dependencies: Object.assign(Object.assign({}, jsonData.dependencies), { [packageNme]: packageVersion }) });
    const jsonString = JSON.stringify(newJsonData, null, 2);
    yield fs_1.promises.writeFile('package.json', jsonString);
});
const addDependecies = (inputedPackageName) => __awaiter(void 0, void 0, void 0, function* () {
    const strippedVersionNumber = getVersion(inputedPackageName);
    const cleanedInput = strippedVersionNumber ? inputedPackageName.split('@')[0] : inputedPackageName;
    const packageResponse = yield fetchPackageMetadata(cleanedInput, strippedVersionNumber);
    const packageNme = packageResponse.name;
    const packageVersion = strippedVersionNumber ? strippedVersionNumber : packageResponse["dist-tags"]["latest"];
    try {
        const data = yield fs_1.promises.readFile('package.json', 'utf8');
        const jsonData = JSON.parse(data);
        yield writeToPackageJson(jsonData, packageNme, packageVersion);
    }
    catch (err) {
        console.error(err);
    }
});
// interface PackageJson {
//   dependencies: PackageDependencies;
// }
const getDependencies = () => __awaiter(void 0, void 0, void 0, function* () {
    const dependenciesList = [];
    try {
        const data = yield fs_1.promises.readFile('package.json');
        const dataJson = JSON.parse(data.toString());
        for (const key in dataJson.dependencies) {
            dependenciesList.push({ [key]: dataJson.dependencies[key] });
        }
        return dependenciesList;
    }
    catch (err) {
        console.error('Error reading/parsing package.json', err);
        return [];
    }
});
const fetchPackageJson = (packageName, versionRange) => __awaiter(void 0, void 0, void 0, function* () {
    const metadata = yield fetchPackageMetadata(packageName);
    console.log(metadata, 'datata');
    if (!metadata) {
        return null;
    }
    const version = semver_1.default.maxSatisfying(Object.keys(metadata.versions), versionRange);
    if (!version) {
        throw new Error(`No satisfying version found for ${packageName} with range ${versionRange}`);
    }
    return metadata.versions[version];
});
// const downloadAndExtractTarball = async (tarballUrl:string, packageName:string): Promise<any> => {
//   const tarballPath = path.join(__dirname, `${packageName}.tgz`);
//   const response = await fetch(tarballUrl);
//   if (!response.ok) {
//     throw new Error(`Failed to fetch ${tarballUrl}: ${response.statusText}`);
//   }
//   const buffer = await response.buffer();
//   await fs.writeFile(tarballPath, buffer);
//   await tar.extract({
//     file: tarballPath,
//     cwd: path.join(__dirname, 'node_modules'),
//   });
//   await fs.unlink(tarballPath); // Clean up the tarball file
// }
const getDependenciesRecursively = (initialDependencies) => __awaiter(void 0, void 0, void 0, function* () {
    const allDependencies = {};
    function addDependencies(dependencies) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const dep of dependencies) {
                const [name, versionRange] = Object.entries(dep)[0];
                if (!allDependencies[name]) {
                    const packageJson = yield fetchPackageJson(name, versionRange);
                    if (packageJson) {
                        allDependencies[name] = packageJson;
                        // await downloadAndExtractTarball(packageJson.dist.tarball, name);
                        if (packageJson.dependencies) {
                            const subDependencies = Object.entries(packageJson.dependencies).map(([key, value]) => ({ [key]: value }));
                            yield addDependencies(subDependencies);
                        }
                    }
                }
            }
        });
    }
    yield addDependencies(initialDependencies);
    return Object.values(allDependencies);
    // return allDependencies;
});
//node package_manager.ts add is-thirteen
if (command in validCommmands && command === "add") {
    addDependecies(packageName);
}
if (command in validCommmands && command == "install") {
    //do some install 
    //put all packages tar url in a set
    //iterate through set and install one by one
    (() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const dependenciesList = yield getDependencies();
            console.log(dependenciesList);
            const allDependecies = yield getDependenciesRecursively([dependenciesList[0]]);
            //  console.log(allDependecies, 'all things')
            //  get the latest version
            //  const packageInfo = await getPackageData(Object.keys(dependenciesList[0])[0])
            //  const version = packageInfo['dist-tags']['latest']
            //  const depVer = packageInfo['versions'][version]
            //  console.log(depVer)
            //  console.log(packageInfo, 'info ++')
        }
        catch (err) {
            console.error(err);
        }
    }))();
}
