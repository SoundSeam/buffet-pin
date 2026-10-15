import { describe, expect, it } from "vitest";
import twilio from "twilio";
import RequestClient from "twilio/lib/base/RequestClient";

const account = "AC00000000000000000000000000000000";
const token = "fixture-not-a-real-credential";

function fixture(status: number, payload: object) {
  const transport = new RequestClient({ autoRetry: false });
  let submissions = 0;
  let encoded = "";
  // Replace the actual Axios adapter before constructing the SDK; no network can occur.
  transport.axios.defaults.adapter = async config => {
    expect(config.url).toBe(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`);
    submissions++; encoded = String(config.data);
    return { status, statusText: "fixture", data: JSON.stringify(payload), headers: {}, config };
  };
  const client = twilio(account, token, { httpClient: transport });
  return { client, transport, submissions: () => submissions, body: () => new URLSearchParams(encoded) };
}

describe("patched Axios/qs through the actual Twilio request boundary", () => {
  it("preserves form encoding, callback URL and response normalization", async () => {
    const f = fixture(201, { sid: "SMfixture", status: "queued" });
    const message = await f.client.messages.create({ to: "+15550000001", from: "+15550000002", body: "Merci & thank you + café", statusCallback: "https://example.invalid/api/twilio/message-status?token=fixture" });
    expect(message).toMatchObject({ sid: "SMfixture", status: "queued" });
    expect(f.body().get("Body")).toBe("Merci & thank you + café");
    expect(f.body().get("To")).toBe("+15550000001");
    expect(f.body().get("StatusCallback")).toContain("/api/twilio/message-status?token=fixture");
    expect(f.submissions()).toBe(1);
  });
  it("preserves provider errors without automatically resubmitting", async () => {
    const f = fixture(400, { code: 21610, message: "fixture recipient opted out" });
    await expect(f.client.messages.create({ to: "+15550000001", from: "+15550000002", body: "fixture" })).rejects.toMatchObject({ code: 21610, status: 400 });
    expect(f.submissions()).toBe(1);
  });
  it("keeps timeouts ambiguous and does not retry a possibly submitted message", async () => {
    const f = fixture(201, {}); let attempts = 0;
    f.transport.axios.defaults.adapter = async () => { attempts++; throw Object.assign(new Error("fixture timeout"), { code: "ETIMEDOUT" }); };
    await expect(f.client.messages.create({ to: "+15550000001", from: "+15550000002", body: "fixture" })).rejects.toMatchObject({ code: "ETIMEDOUT" });
    expect(attempts).toBe(1);
  });
  it("keeps signed callback validation bound to URL and payload", () => {
    const url = "https://example.invalid/api/twilio/message-status";
    const params = { MessageSid: "SMfixture", MessageStatus: "delivered" };
    const signature = twilio.getExpectedTwilioSignature(token, url, params);
    expect(twilio.validateRequest(token, signature, url, params)).toBe(true);
    expect(twilio.validateRequest(token, signature, url, { ...params, MessageStatus: "failed" })).toBe(false);
  });
});
