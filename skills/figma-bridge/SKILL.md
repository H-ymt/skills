---
name: figma-bridge
description: Use this whenever you need to read or draw/edit a Figma design (frames, nodes, screenshots, styles, variables). While the team is on a free Figma plan, go through the figma-bridge MCP server instead of the rate-limited Figma API / "Figma Desktop" MCP.
---
# Reading and drawing in Figma through figma-bridge

A temporary workaround. The free Figma plan allows only a handful of API/MCP reads a month. Once the company moves to a paid Figma plan, go back to the official Figma MCP and delete this skill.

## Rules
- Use the `figma-bridge` MCP tools for Figma. Don't use the `Figma Desktop` MCP or the Figma REST API.
- Before reading, the Figma desktop app must have the target file open with the "Figma MCP Bridge" plugin running, and the plugin window must say "WebSocket Connected". If a tool reports no connection, ask the user to run or reopen the plugin. Check `curl -s localhost:1994/ping` if needed.
- Drawing and editing are fine when the task calls for it: create_* (frames, text, shapes, images, SVG, pages), set_* (text, fills, effects, auto layout, properties), layout helpers, import_html_layers. Write tools need the plugin open in the design editor (Dev Mode is read-only) and edit permission on the file.
- Prefer working on a new page or frame rather than changing existing designs, unless asked to change them.
- `delete_nodes` only after the user confirms which nodes.

## Useful tools
- `list_files` lists the connected files and their `fileKey`. Pass `fileKey` when more than one file is connected.
- `get_metadata`, `get_document`, and `get_selection`.
- `get_node` takes the node ID in colon form, such as `4029:12345`. A URL's `node-id=4029-12345` becomes `4029:12345`.
- `get_design_context` returns a depth-limited tree, the best start for implementing a design.
- `get_styles` and `get_variable_defs` return styles and tokens.
- `get_screenshot` and `save_screenshots` return images.
