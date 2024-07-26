var fs = require("fs");
// todo
//[x]init pckJson file
//[x]write to pckJson file
//[]fetch data from registry
//[]recurse on dependencies
//[]install to node_modules
//[]edge cases?
//[]tests

const validCommmands = {"add": true, "install": true}

const args = process.argv.slice(2);
const command = args[0];
const packageName = args[1];

const writeToJson = async (filePath, jsonData, dependencie) => {
  const newJsonData = {...jsonData, dependencies: {...jsonData.dependencies, "change this1": "version2"}};
  const jsonString = JSON.stringify(newJsonData, null, 2);

  fs.writeFile(filePath, jsonString, (err) => {
    if (err) {
      console.error(err);
      return;
    } else {
      console.log('file modified');
    }
  });
}

const addDependecies = async (inputedPackageName) => {
  fs.readFile('package.json', (err, data) => {
    if (err) {
      console.error("error reading package.json", err);
      return;  
    }

    const jsonString = data.toString();
    
    try{
      const jsonData = JSON.parse(jsonString);
      writeToJson('package.json', jsonData, {"name": "aemp2", "version": "2"});
    } catch (parseErr) {
      console.log('Error parsing json', parseErr);
    }
})
  }

if(command in validCommmands && command === "add") {
  addDependecies(packageName)
}