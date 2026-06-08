import type { Metadata } from "next";
import { PolicyPage } from "@/components/content/PolicyPage";
import { getPolicy, policyMetadata, relatedPolicies } from "@/lib/policies";

const policy = getPolicy("conduct");

export const metadata: Metadata = policyMetadata(policy);

export default function ConductPolicyPage() {
  return <PolicyPage policy={policy} related={relatedPolicies("conduct")} />;
}
