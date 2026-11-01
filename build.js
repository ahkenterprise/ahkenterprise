const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

try {
  console.log("Current directory contents:", fs.readdirSync('.'));
  
  const zipFilePath = './AHK APP WORLD.zip';
  if (!fs.existsSync(zipFilePath)) {
    throw new Error("Zip file not found: " + zipFilePath);
  }

  console.log("Extracting zip...");
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo('.', true);

  // Flatten the folder if it creates one
  const nestedFolder = './AHK APP WORLD';
  if (fs.existsSync(nestedFolder) && fs.lstatSync(nestedFolder).isDirectory()) {
    console.log("Moving files out of nested folder...");
    const files = fs.readdirSync(nestedFolder);
    for (const file of files) {
      fs.renameSync(path.join(nestedFolder, file), path.join('.', file));
    }
    fs.rmSync(nestedFolder, { recursive: true, force: true });
  }
  
  console.log("Build step completed successfully.");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
