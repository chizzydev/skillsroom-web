"use client";

import { useState } from "react";
import {
  livestreamProviderLabels,
  livestreamUrlPlaceholders,
  supportedLivestreamProviders,
  type SupportedLivestreamProvider
} from "@/lib/livestream-url";

type LivestreamLinkFieldsProps = {
  streamLinkLabel?: string;
};

export function LivestreamLinkFields({ streamLinkLabel = "Stream link" }: LivestreamLinkFieldsProps) {
  const [provider, setProvider] = useState<SupportedLivestreamProvider>("youtube");

  return (
    <>
      <label className="grid gap-2 text-sm font-bold text-ink">
        Provider
        <select
          className="min-h-11 min-w-0 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
          name="provider"
          onChange={(event) => setProvider(event.target.value as SupportedLivestreamProvider)}
          value={provider}
        >
          {supportedLivestreamProviders.map((item) => (
            <option key={item} value={item}>
              {livestreamProviderLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-bold text-ink">
        {streamLinkLabel}
        <input
          className="min-h-11 min-w-0 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
          name="stream_url"
          placeholder={livestreamUrlPlaceholders[provider]}
          required
          type="url"
        />
      </label>
    </>
  );
}
