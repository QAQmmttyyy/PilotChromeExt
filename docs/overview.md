# PilotChromeExt Module Documentation

## Introduction

The PilotChromeExt module is a part of the PagePilot AI Chrome extension, which aims to enhance the user's web browsing experience by integrating AI capabilities directly into the browsing context. This eliminates the need for tab switching or copy-pasting, allowing users to access AI tools right where they're reading ([source](https://github.com/Akezh/Page-pilot-AI)).

## Architecture Overview

The PilotChromeExt module is composed of several sub-modules and core components. The architecture of the module is as follows:

- `src/lib/types.ts`: Defines the types used in the workflow steps and context, as well as the ready event types.
- `packages/shared/src/types/workflow.ts`: Defines the types used in the workflow steps and context, as well as the types for recorded steps and elements.
- `src/components/agent/ChatPanel.tsx`: Defines the properties for the ChatPanel component.
- `src/components/agent/Agent.ts`: Defines the Agent component and its functionalities.
- `src/components/ui/button.tsx`: Defines the properties for the Button component.

Each of these components plays a crucial role in the functioning of the PilotChromeExt module. Detailed descriptions of each component and their responsibilities are provided in the subsequent sections.

## Core Functionality

The PilotChromeExt module primarily serves to facilitate the integration of AI capabilities into the user's web browsing context. It achieves this through the following core functionalities:

- **Workflow Management**: The module manages the execution of various workflow steps, each of which represents a specific task to be performed. The types for these workflow steps and the context in which they are executed are defined in `src/lib/types.ts` and `packages/shared/src/types/workflow.ts`.
- **Chat Panel**: The ChatPanel component (`src/components/agent/ChatPanel.tsx`) provides an interface for users to interact with the AI tools. It manages the chat ID and handles the creation of new conversations.
- **Agent**: The Agent component (`src/components/agent/Agent.ts`) is responsible for executing the workflow steps. It injects the necessary scripts into the webpage and manages the execution of AI tools.
- **UI Components**: The module also includes UI components like the Button component (`src/components/ui/button.tsx`), which are used across the extension for consistent UI design.

## Sub-modules

Detailed descriptions of each sub-module can be found in their respective documentation files:

- [src/lib/types.md](src/lib/types.md)
- [packages/shared/src/types/workflow.md](packages/shared/src/types/workflow.md)
- [src/components/agent/ChatPanel.md](src/components/agent/ChatPanel.md)
- [src/components/agent/Agent.md](src/components/agent/Agent.md)
- [src/components/ui/button.md](src/components/ui/button.md)

## How the Module Fits into the Overall System

The PilotChromeExt module is a crucial part of the PagePilot AI Chrome extension. It provides the core functionalities required for the integration of AI tools into the user's web browsing context. The module interacts with other parts of the system, such as the AI SDK and the backend server, to execute the AI tools and manage the user's interactions with them.