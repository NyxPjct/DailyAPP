import type { SupabaseClient } from "@supabase/supabase-js";
import { validateData } from "../domain";
import type { WorkspaceGateway } from "./workspace";

export function supabaseGateway(
  client: SupabaseClient,
  userId: string,
): WorkspaceGateway {
  return {
    async load() {
      const { data, error } = await client
        .from("dailyapp_workspaces")
        .select("document, revision")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            document: validateData(data.document),
            revision: Number(data.revision),
          }
        : null;
    },
    async save(document, expectedRevision) {
      const { data, error } = await client.rpc("save_dailyapp_workspace", {
        p_document: document,
        p_expected_revision: expectedRevision,
        p_owner_id: userId,
      });
      if (error) throw error;
      const row = data?.[0];
      return row
        ? {
            document: validateData(row.document),
            revision: Number(row.revision),
          }
        : null;
    },
  };
}
