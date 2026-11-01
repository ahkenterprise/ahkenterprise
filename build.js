const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

try {
  console.log("Starting build process...");
  const zipFilePath = './AHK APP WORLD.zip';
  
  if (!fs.existsSync(zipFilePath)) {
    throw new Error("Zip file not found: " + zipFilePath);
  }

  console.log("Extracting zip file...");
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo('.', true);

  const nestedFolder = './AHK APP WORLD';
  
  // If the zip extracted a folder, move everything out of it
  if (fs.existsSync(nestedFolder) && fs.lstatSync(nestedFolder).isDirectory()) {
    console.log("Moving files out of nested folder...");
    const files = fs.readdirSync(nestedFolder);
    
    // 🔥 THIS IS THE MAGIC LIST
    // We skip these files so the zip does NOT overwrite the secure versions you made in GitHub!
    const skipList = [
      'netlify',       // Protects your backend functions
      'package.json',  // Protects your build setup
      'netlify.toml',  // Protects your redirect settings
      'build.js',      // Protects this script
      'app.js',        // Protects your new frontend code
      'index.html',    // Protects your new HTML (with the 5-tap logo fix)
      'deter.js',      // Protects your security script
      '.git',
      'node_modules'
    ];

    for (const file of files) {
      if (skipList.includes(file)) {
        console.log(`Skipping ${file} (using the GitHub version instead)`);
        continue; 
      }
      
      const src = path.join(nestedFolder, file);
      const dest = path.join('.', file);
      
      // If a file with the same name exists, delete it first to avoid crashes
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      
      // Move the file out of the nested folder into the main directory
      fs.renameSync(src, dest);
    }
    
    // Clean up the empty nested folder
    fs.rmSync(nestedFolder, { recursive: true, force: true });
  }
  
  console.log("Build completed successfully!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
