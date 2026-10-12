// Usage: npm run set-password
// Prompts for the dashboard password (hidden) and stores a hash in auth.json.
import readline from "readline";

import { setPassword } from "./auth.js";

const MIN_LENGTH = 8;

function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });

    // Hide what's typed (everything after the prompt itself).
    let prompted = false;
    rl._writeToOutput = (text) => {
        if (!prompted) {
            process.stdout.write(text);
            prompted = text.includes(question);
        }
    };

    return new Promise((resolve) =>
        rl.question(question, (answer) => {
            rl.close();
            process.stdout.write("\n");
            resolve(answer);
        }),
    );
}

// ACS_NEW_PASSWORD is for scripted/test use only; normally you're prompted.
const password =
    process.env.ACS_NEW_PASSWORD ?? (await ask("New password: "));

if (password.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    process.exit(1);
}

if (
    process.env.ACS_NEW_PASSWORD === undefined &&
    password !== (await ask("Confirm password: "))
) {
    console.error("Passwords didn't match. Nothing changed.");
    process.exit(1);
}

await setPassword(password);
console.log("Password saved. Everyone has been signed out.");
