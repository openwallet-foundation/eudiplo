import * as x509 from "@peculiar/x509";
import { X509CertificateGenerator } from "@peculiar/x509";
import { exportJWK } from "jose/key/export";

/**
 * Generate a self-signed CA certificate PEM from a JWK.
 * This is used to create trust anchors for the OIDF test runner.
 */
export async function generateCaCertPem(jwk: {
    d: string;
    x: string;
    y: string;
    crv?: string;
}): Promise<string> {
    const signingAlg = { name: "ECDSA", hash: "SHA-256" };

    // Import the private key
    const privateKey = await globalThis.crypto.subtle.importKey(
        "jwk",
        {
            kty: "EC",
            crv: jwk.crv ?? "P-256",
            d: jwk.d,
            x: jwk.x,
            y: jwk.y,
        },
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"],
    );

    // Import the public key
    const publicKey = await globalThis.crypto.subtle.importKey(
        "jwk",
        {
            kty: "EC",
            crv: jwk.crv ?? "P-256",
            x: jwk.x,
            y: jwk.y,
        },
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"],
    );

    // Generate self-signed CA certificate
    const caCert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name: "CN=EUDIPLO Test CA",
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
        signingAlgorithm: signingAlg,
        keys: { privateKey, publicKey },
        extensions: [
            new x509.BasicConstraintsExtension(true, undefined, true),
            new x509.KeyUsagesExtension(
                x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
                true,
            ),
        ],
    });

    return caCert.toString("pem");
}

/**
 * Generate a CA-signed certificate chain for OIDF testing.
 * Returns a JWK with proper x5c containing [leaf, CA] certificates.
 * The leaf certificate is NOT self-signed (issuer = CA, subject = leaf).
 */
export async function generateCaSignedJwk(options: {
    use: "sig" | "enc";
    alg: "ES256" | "ECDH-ES";
    cn: string;
}): Promise<{
    kty: string;
    d: string;
    use: string;
    crv: string;
    kid: string;
    x: string;
    y: string;
    alg: string;
    x5c: string[];
}> {
    const signingAlg = { name: "ECDSA", hash: "SHA-256" };

    // Generate CA key pair
    const caKeyPair = await globalThis.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
    );

    // Generate CA certificate (self-signed root)
    const caCert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name: "CN=OIDF Test CA",
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
        signingAlgorithm: signingAlg,
        keys: caKeyPair,
        extensions: [
            new x509.BasicConstraintsExtension(true, undefined, true),
            new x509.KeyUsagesExtension(
                x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
                true,
            ),
        ],
    });

    // Generate leaf key pair
    const leafKeyPair = await globalThis.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
    );

    // Generate leaf certificate signed by CA
    const leafCert = await X509CertificateGenerator.create({
        serialNumber: "02",
        subject: `CN=${options.cn}`,
        issuer: caCert.subject,
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        signingAlgorithm: signingAlg,
        publicKey: leafKeyPair.publicKey,
        signingKey: caKeyPair.privateKey,
        extensions: [
            new x509.BasicConstraintsExtension(false, undefined, true),
            new x509.KeyUsagesExtension(
                x509.KeyUsageFlags.digitalSignature,
                true,
            ),
            // Add SAN for localhost and test domains
            new x509.SubjectAlternativeNameExtension([
                { type: "dns", value: "localhost" },
                { type: "dns", value: "host.testcontainers.internal" },
            ]),
        ],
    });

    // Export the leaf private key as JWK
    const leafJwk = await exportJWK(leafKeyPair.privateKey);

    // Generate kid from public key
    const leafPublicJwk = await exportJWK(leafKeyPair.publicKey);
    const kidData = new TextEncoder().encode(
        JSON.stringify({ x: leafPublicJwk.x, y: leafPublicJwk.y }),
    );
    const kidHash = await globalThis.crypto.subtle.digest("SHA-256", kidData);
    const kid = Buffer.from(kidHash).toString("base64url").substring(0, 43);

    return {
        kty: "EC",
        d: leafJwk.d as string,
        use: options.use,
        crv: "P-256",
        kid,
        x: leafJwk.x as string,
        y: leafJwk.y as string,
        alg: options.alg,
        x5c: [leafCert.toString("base64"), caCert.toString("base64")],
    };
}
