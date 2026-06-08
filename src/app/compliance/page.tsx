import type { Metadata } from "next";
import { PolicyPage } from "@/components/content/PolicyPage";
import { getPolicy, policyMetadata, relatedPolicies } from "@/lib/policies";

const policy = getPolicy("compliance");

export const metadata: Metadata = policyMetadata(policy);

export default function ComplianceNotesPage() {
  return <PolicyPage policy={policy} related={relatedPolicies("compliance")} />;
}
