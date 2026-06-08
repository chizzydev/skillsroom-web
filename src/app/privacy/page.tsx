import type { Metadata } from "next";
import { PolicyPage } from "@/components/content/PolicyPage";
import { getPolicy, policyMetadata, relatedPolicies } from "@/lib/policies";

const policy = getPolicy("privacy");

export const metadata: Metadata = policyMetadata(policy);

export default function PrivacyPage() {
  return <PolicyPage policy={policy} related={relatedPolicies("privacy")} />;
}
