const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const roots = [
    path.join(__dirname, "..", "assets", "js"),
    path.join(__dirname, "..", "tests")
];

function collectJavaScriptFiles(directory) {

    const results = [];

    for (const entry of fs.readdirSync(directory, {
        withFileTypes: true
    })) {

        const fullPath =
            path.join(directory, entry.name);

        if (entry.isDirectory()) {

            results.push(
                ...collectJavaScriptFiles(fullPath)
            );

            continue;

        }

        if (
            entry.isFile() &&
            entry.name.endsWith(".js")
        ) {

            results.push(fullPath);

        }

    }

    return results;

}

const files = roots.flatMap(
    collectJavaScriptFiles
);

let failed = false;

for (const file of files) {

    const result = spawnSync(
        process.execPath,
        ["--check", file],
        {
            encoding: "utf8"
        }
    );

    if (result.status !== 0) {

        failed = true;

        console.error(
            `\nSyntax error in: ${file}\n`
        );

        console.error(
            result.stderr ||
            result.stdout
        );

    }

}

if (failed) {

    process.exit(1);

}

console.log(
    `Syntax check passed for ${files.length} JavaScript files.`
);