import React, { useState } from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";
import { modify, applyEdits } from "jsonc-parser";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const setJson = useJson(state => state.setJson);
  const getJson = useJson(state => state.getJson);
  const setContents = useFile(state => state.setContents);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(() => normalizeNodeData(nodeData?.text ?? []));

  // keep editValue in sync when selected node changes
  React.useEffect(() => {
    setEditValue(normalizeNodeData(nodeData?.text ?? []));
    setIsEditing(false);
  }, [nodeData?.id]);

  const handleCancel = () => {
    setEditValue(normalizeNodeData(nodeData?.text ?? []));
    setIsEditing(false);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editValue);
      const currentText = getJson();
      const currentObj = JSON.parse(currentText);

      const path = nodeData?.path && nodeData.path.length > 0 ? nodeData.path : [];

      // traverse to target to detect its type
      let target: any = currentObj;
      for (let i = 0; i < (nodeData?.path?.length ?? 0); i++) {
        target = target[nodeData!.path![i] as any];
        if (typeof target === "undefined") break;
      }

      // If both target and parsed are plain objects, merge keys instead of replacing whole node
      if (target && typeof target === "object" && !Array.isArray(target) && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        let updatedText = currentText;
        for (const key of Object.keys(parsed)) {
          const newPath = [...(path as any[]), key];
          const edits = modify(updatedText, newPath as any, parsed[key], {
            formattingOptions: { insertSpaces: true, tabSize: 2 },
          });
          updatedText = applyEdits(updatedText, edits);
        }
  setJson(updatedText);
  // also update the left editor contents so the text editor shows the change
  setContents({ contents: updatedText, skipUpdate: true, hasChanges: false });
        setIsEditing(false);
        return;
      }

      // fallback: replace the node value at the path (or root)
      const edits = modify(currentText, path as any, parsed, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      });
      const updatedText = applyEdits(currentText, edits);
  setJson(updatedText);
  // sync the file editor contents too
  setContents({ contents: updatedText, skipUpdate: true, hasChanges: false });
      setIsEditing(false);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("Invalid JSON. Please correct the content before saving.");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Group>
              {!isEditing && (
                <Button size="xs" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
              {isEditing && (
                <>
                  <Button size="xs" color="green" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="xs" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Group>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {!isEditing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                minRows={6}
                maw={600}
                miw={350}
                value={editValue}
                onChange={e => setEditValue(e.currentTarget.value)}
                styles={{ input: { fontFamily: "monospace" } }}
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
