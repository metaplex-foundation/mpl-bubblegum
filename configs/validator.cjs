const path = require("path");

const programDir = path.join(__dirname, "..", "programs");
function getProgram(dir, programName) {
  return path.join(programDir, dir, "target", "deploy", programName);
}

module.exports = {
  validator: {
    commitment: "processed",
    programs: [
      {
        label: "Mpl Project Name",
        programId: "MyProgram1111111111111111111111111111111111",
        deployPath: getProgram("mpl-project-name", "mpl_project_name.so"),
      },
    ],
  },
};
