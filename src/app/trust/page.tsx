import type { Metadata } from "next";
import { PolicyPage } from "@/components/content/PolicyPage";
import { getPolicy, policyMetadata, relatedPolicies } from "@/lib/policies";

const policy = getPolicy("trust");

export const metadata: Metadata = policyMetadata(policy);

export default function TrustPage() {
  return <PolicyPage policy={policy} related={relatedPolicies("trust")} />;
}
