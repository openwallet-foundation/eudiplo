import { INestApplication } from "@nestjs/common";
import { decodeProtectedHeader } from "jose";
import request from "supertest";
import { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { IssuanceTestContext, setupIssuanceTestApp } from "../utils";

function parseBinary(
    res: NodeJS.ReadableStream,
    callback: (err: Error | null, body: Buffer) => void,
) {
    const chunks: Buffer[] = [];
    res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    res.on("end", () => callback(null, Buffer.concat(chunks)));
    res.on("error", (err) => callback(err, Buffer.alloc(0)));
}

describe("Status List - Token Format Negotiation", () => {
    let app: INestApplication<App>;
    let authToken: string;
    let listId: string;

    beforeAll(async () => {
        const ctx: IssuanceTestContext = await setupIssuanceTestApp();
        app = ctx.app;
        authToken = ctx.authToken;

        const createdList = await request(app.getHttpServer())
            .post("/status-lists")
            .set("Authorization", `Bearer ${authToken}`)
            .send({})
            .expect(201);

        listId = createdList.body.id;
        expect(listId).toBeDefined();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    test("returns JWT by default", () => {
        return request(app.getHttpServer())
            .get(`/issuers/root/status-management/status-list/${listId}`)
            .expect((response) => {
                expect(response.headers["content-type"]).toContain(
                    "application/statuslist+jwt",
                );
                expect(typeof response.text).toBe("string");

                const header = decodeProtectedHeader(response.text);
                expect(header.typ).toBe("statuslist+jwt");
            })
            .expect(200);
    });

    test("returns CWT when Accept requests application/statuslist+cwt", () => {
        return request(app.getHttpServer())
            .get(`/issuers/root/status-management/status-list/${listId}`)
            .set("Accept", "application/statuslist+cwt")
            .buffer(true)
            .parse(parseBinary)
            .expect((response) => {
                expect(response.headers["content-type"]).toContain(
                    "application/statuslist+cwt",
                );

                expect(Buffer.isBuffer(response.body)).toBe(true);
                expect(response.body.length).toBeGreaterThan(32);
                // COSE_Sign1 with CBOR tag 18 starts with 0xd2
                expect(response.body[0]).toBe(0xd2);
            })
            .expect(200);
    });

    test("returns CWT when Content-Type requests application/statuslist+cwt", () => {
        return request(app.getHttpServer())
            .get(`/issuers/root/status-management/status-list/${listId}`)
            .set("Content-Type", "application/statuslist+cwt")
            .buffer(true)
            .parse(parseBinary)
            .expect((response) => {
                expect(response.headers["content-type"]).toContain(
                    "application/statuslist+cwt",
                );

                expect(Buffer.isBuffer(response.body)).toBe(true);
                expect(response.body.length).toBeGreaterThan(32);
                // COSE_Sign1 with CBOR tag 18 starts with 0xd2
                expect(response.body[0]).toBe(0xd2);
            })
            .expect(200);
    });
});
