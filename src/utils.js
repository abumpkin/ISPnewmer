exports.logobj = (obj) => {
  for (let i of Object.getOwnPropertyNames(obj)) {
    console.log(`${i}: ${obj[i]}`);
  }
};
