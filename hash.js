const bcrypt = require("bcrypt");

async function run() {
  const residentHash = await bcrypt.hash("resident123", 10);
  const authorityHash = await bcrypt.hash("Authority123!", 10);

  console.log("resident123:", residentHash);
  console.log("Authority123!:", authorityHash);
}

run();