import { useQuery } from "@tanstack/react-query";
import { PilotHttpClient } from "./pilot_http_client";
import { pilot_query_keys } from "./pilot_query_keys";

const pilot_client = new PilotHttpClient();

export function usePilotHealth() {
  return useQuery({
    queryKey: pilot_query_keys.health,
    queryFn: () => pilot_client.getHealth(),
    retry: 2
  });
}

export function usePilotSnapshot() {
  return useQuery({
    queryKey: pilot_query_keys.snapshot,
    queryFn: () => pilot_client.getSnapshot(),
    retry: 2
  });
}

export function usePilotComponents() {
  return useQuery({
    queryKey: pilot_query_keys.components,
    queryFn: () => pilot_client.getComponents(),
    retry: 2
  });
}

export function usePilotEndpoints() {
  return useQuery({
    queryKey: pilot_query_keys.endpoints,
    queryFn: () => pilot_client.getEndpoints(),
    retry: 2
  });
}

export function useRobotStatusStreams() {
  return useQuery({
    queryKey: pilot_query_keys.robot_status_streams,
    queryFn: () => pilot_client.getRobotStatusStreams(),
    retry: 2
  });
}
