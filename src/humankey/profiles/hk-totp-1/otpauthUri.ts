export type OtpAuthUriInput = {
  issuer: "Abracadoo";
  accountName: string;
  secretBase32: string;
  algorithm: "SHA1";
  digits: 6;
  period: 30;
};

export function createOtpAuthUri(input: OtpAuthUriInput): string {
  const label = `${input.issuer}:${input.accountName}`;
  const params = new URLSearchParams({
    secret: input.secretBase32,
    issuer: input.issuer,
    algorithm: input.algorithm,
    digits: String(input.digits),
    period: String(input.period),
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
