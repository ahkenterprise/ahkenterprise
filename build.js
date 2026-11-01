const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

try {
  console.log("Starting build...");
  const zipFilePath = './AHK APP WORLD.zip';
  
  if (!fs.existsSync(zipFilePath)) {
    throw new Error("Zip file not found: " + zipFilePath);
  }

  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo('.', true);

  const nestedFolder = './AHK APP WORLD';
  if (fs.existsSync(nestedFolder) && fs.lstatSync(nestedFolder).isDirectory()) {
    console.log("Moving files out of nested folder...");
    const files = fs.readdirSync(nestedFolder);
    
    // 🔥 We only skip the files we manually created/updated in GitHub.
    // We let index.html, logo.png, deter.js, and your app folders unzip normally!
    const skipList = [
      'netlify', 'package.json', 'netlify.toml', 'build.js', 
      'app.js', '.git', 'node_modules'
    ];

    for (const file of files) {
      if (skipList.includes(file)) {
        console.log(`Skipping ${file} (using the GitHub version)`);
        continue; 
      }
      const src = path.join(nestedFolder, file);
      const dest = path.join('.', file);
      if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
      fs.renameSync(src, dest);
    }
    fs.rmSync(nestedFolder, { recursive: true, force: true });
  }
  console.log("Build successful.");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
