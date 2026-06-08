import type { Metadata } from "next";
import { PolicyPage } from "@/components/content/PolicyPage";
import { getPolicy, policyMetadata, relatedPolicies } from "@/lib/policies";

const policy = getPolicy("rules");

export const metadata: Metadata = policyMetadata(policy);

export default function RulesPage() {
  return <PolicyPage policy={policy} related={relatedPolicies("rules")} />;
}
