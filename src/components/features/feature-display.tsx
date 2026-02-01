"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Code, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { SampleFeature } from "@/db/schema";

interface FeatureDisplayProps {
  features: SampleFeature[];
}

interface ChannelFeatures {
  [channel: string]: {
    [featureName: string]: number | string | null;
  };
}

interface GlobalFeatures {
  [key: string]: number | string | null;
}

interface MetadataFeatures {
  [key: string]: number | string | null;
}

function parseFeatures(features: unknown): {
  channels: ChannelFeatures;
  global: GlobalFeatures;
  metadata: MetadataFeatures;
} {
  const result: {
    channels: ChannelFeatures;
    global: GlobalFeatures;
    metadata: MetadataFeatures;
  } = {
    channels: {},
    global: {},
    metadata: {},
  };

  if (!features || typeof features !== "object") {
    return result;
  }

  const featuresObj = features as Record<string, unknown>;

  for (const [key, value] of Object.entries(featuresObj)) {
    if (key.startsWith("channel.")) {
      // Parse channel.CHANNEL_NAME.feature_name
      const parts = key.split(".");
      if (parts.length >= 3) {
        const channelName = parts[1];
        const featureName = parts.slice(2).join(".");
        if (!result.channels[channelName]) {
          result.channels[channelName] = {};
        }
        result.channels[channelName][featureName] = value as number | string | null;
      }
    } else if (key.startsWith("global.")) {
      const featureName = key.substring(7);
      result.global[featureName] = value as number | string | null;
    } else if (key.startsWith("metadata.")) {
      const metaName = key.substring(9);
      result.metadata[metaName] = value as number | string | null;
    }
  }

  return result;
}

function formatFeatureValue(value: number | string | null): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    // Format numbers with reasonable precision
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(4);
  }
  return String(value);
}

function ChannelSection({
  channelName,
  features,
}: {
  channelName: string;
  features: Record<string, number | string | null>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="font-medium">{channelName}</span>
          <Badge variant="secondary" className="ml-auto">
            {Object.keys(features).length} features
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-2">
          {Object.entries(features).map(([name, value]) => (
            <div key={name} className="text-sm">
              <span className="text-muted-foreground">{name}:</span>{" "}
              <span className="font-mono">{formatFeatureValue(value)}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FeatureDisplay({ features }: FeatureDisplayProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (features.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No features computed yet.</p>
        <p className="text-sm">Upload an artifact and click &quot;Extract Features&quot; to compute.</p>
      </div>
    );
  }

  // Get the most recent feature set
  const latestFeature = features[0];
  const parsed = parseFeatures(latestFeature.features);
  const channelNames = Object.keys(parsed.channels).sort();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Computed at: {formatDateTime(latestFeature.computedAt)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRawJson(!showRawJson)}
        >
          <Code className="h-4 w-4 mr-2" />
          {showRawJson ? "Hide JSON" : "Show JSON"}
        </Button>
      </div>

      {showRawJson ? (
        <pre className="bg-muted p-4 rounded-md overflow-auto text-xs max-h-96">
          {JSON.stringify(latestFeature.features, null, 2)}
        </pre>
      ) : (
        <div className="space-y-2">
          {/* Global features */}
          {Object.keys(parsed.global).length > 0 && (
            <div className="border rounded-md p-3">
              <h4 className="font-medium mb-2">Global Features</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(parsed.global).map(([name, value]) => (
                  <div key={name} className="text-sm">
                    <span className="text-muted-foreground">{name}:</span>{" "}
                    <span className="font-mono">{formatFeatureValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {Object.keys(parsed.metadata).length > 0 && (
            <div className="border rounded-md p-3">
              <h4 className="font-medium mb-2">Metadata</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(parsed.metadata).map(([name, value]) => (
                  <div key={name} className="text-sm">
                    <span className="text-muted-foreground">{name}:</span>{" "}
                    <span className="font-mono">{formatFeatureValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Channel features */}
          {channelNames.length > 0 && (
            <div className="border rounded-md">
              <h4 className="font-medium p-3 border-b">Channel Features</h4>
              <div className="divide-y">
                {channelNames.map((channelName) => (
                  <ChannelSection
                    key={channelName}
                    channelName={channelName}
                    features={parsed.channels[channelName]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
