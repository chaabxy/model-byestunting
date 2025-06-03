// Script untuk extract weights dari model.json
// Jalankan ini untuk mendapatkan weights asli

import fs from "fs";

// Baca model.json
const modelData = JSON.parse(
  fs.readFileSync("./tfjs_model/model.json", "utf8")
);

console.log("Model Architecture:");
console.log(
  JSON.stringify(modelData.modelTopology.model_config.config.layers, null, 2)
);

// Baca weights manifest
const weightsManifest = modelData.weightsManifest[0];
console.log("\nWeights Info:");
weightsManifest.weights.forEach((weight, index) => {
  console.log(`${index}: ${weight.name} - Shape: [${weight.shape.join(", ")}]`);
});

// Untuk mendapatkan weights asli, kita perlu membaca binary file
console.log("\nUntuk mendapatkan weights asli, perlu membaca file binary:");
console.log("group1-shard1of1.bin");
