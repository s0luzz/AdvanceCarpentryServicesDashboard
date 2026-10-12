import crypto from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Kept out of db.json (which is committed to git). Git-ignored.
const authPath =
    process.env.AUTH_FILE ||
    path.join(__dirname, "..", "auth.json");

export const COOKIE_NAME = "acs_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failures = new Map(); // ip -> { count, lockedUntil }

async function readAuth() {
    try {
        return JSON.parse(await fs.readFile(authPath, "utf-8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return { password: null, sessions: {} };
        }

        throw error;
    }
}

async function writeAuth(data) {
    const tmp = `${authPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), {
        mode: 0o600,
    });
    await fs.rename(tmp, authPath);
}

const sha256 = (value) =>
    crypto.createHash("sha256").update(value).digest("hex");

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { salt, hash };
}

function passwordMatches(password, stored) {
    const { hash } = hashPassword(password, stored.salt);

    return crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(stored.hash, "hex"),
    );
}

// Setting a password signs everyone out.
export async function setPassword(password) {
    await writeAuth({
        password: hashPassword(password),
        sessions: {},
    });
}

export async function hasPassword() {
    return Boolean((await readAuth()).password);
}

export function parseCookies(header = "") {
    return Object.fromEntries(
        header
            .split(";")
            .map((part) => part.trim().split("="))
            .filter(([key]) => key)
            .map(([key, ...rest]) => [key, rest.join("=")]),
    );
}

export function clientIp(req) {
    return (
        String(req.headers["x-forwarded-for"] ?? "")
            .split(",")[0]
            .trim() || req.socket.remoteAddress
    );
}

export function lockoutRemainingMs(ip) {
    const entry = failures.get(ip);

    return entry?.lockedUntil && entry.lockedUntil > Date.now()
        ? entry.lockedUntil - Date.now()
        : 0;
}

// Returns a new session token, or null for a wrong password.
export async function login(password, ip) {
    const auth = await readAuth();

    if (
        !auth.password ||
        typeof password !== "string" ||
        !passwordMatches(password, auth.password)
    ) {
        const entry = failures.get(ip) ?? { count: 0 };
        entry.count += 1;

        if (entry.count >= MAX_FAILURES) {
            entry.lockedUntil = Date.now() + LOCKOUT_MS;
            entry.count = 0;
        }

        failures.set(ip, entry);
        return null;
    }

    failures.delete(ip);

    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();

    // Only a hash of the token is stored; drop expired sessions as we go.
    auth.sessions = Object.fromEntries(
        Object.entries(auth.sessions).filter(
            ([, expires]) => expires > now,
        ),
    );
    auth.sessions[sha256(token)] = now + SESSION_MS;

    await writeAuth(auth);
    return token;
}

export async function isValidSession(token) {
    if (!token) {
        return false;
    }

    const expires = (await readAuth()).sessions[sha256(token)];

    return Boolean(expires && expires > Date.now());
}

export async function logout(token) {
    if (!token) {
        return;
    }

    const auth = await readAuth();
    delete auth.sessions[sha256(token)];
    await writeAuth(auth);
}

export function sessionCookie(token, req, maxAgeMs = SESSION_MS) {
    const secure = String(req.headers["x-forwarded-proto"] ?? "")
        .split(",")[0]
        .trim() === "https";

    return [
        `${COOKIE_NAME}=${token}`,
        "HttpOnly",
        "SameSite=Lax",
        "Path=/",
        `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
        secure ? "Secure" : "",
    ]
        .filter(Boolean)
        .join("; ");
}
