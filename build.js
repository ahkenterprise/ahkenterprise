const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

try {
  console.log("Starting build...");
  const zipFilePath = './AHK APP WORLD.zip';
  
  if (!fs.existsSync(zipFilePath)) {
    throw new Error("Zip file not found: " + zipFilePath);
  }

  console.log("Extracting zip...");
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo('.', true);

  const nestedFolder = './AHK APP WORLD';
  if (fs.existsSync(nestedFolder) && fs.lstatSync(nestedFolder).isDirectory()) {
    console.log("Moving files out of nested folder...");
    const files = fs.readdirSync(nestedFolder);
    
    // These are files we ALREADY set up correctly in the root. We will skip them.
    const skipList = ['netlify', 'package.json', 'netlify.toml', 'build.js', '.git', 'node_modules'];

    for (const file of files) {
      if (skipList.includes(file)) {
        console.log(`Skipping ${file} (using the root version instead).`);
        continue; 
      }
      
      const src = path.join(nestedFolder, file);
      const dest = path.join('.', file);
      
      // If destination exists, remove it first to avoid errors
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      
      fs.renameSync(src, dest);
    }
    
    // Clean up the nested folder
    fs.rmSync(nestedFolder, { recursive: true, force: true });
  }
  
  console.log("Build step completed successfully.");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
