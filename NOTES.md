# NOTES.md — Live Session Widget
Feature submission by Jason Gao

## Design
- The widget encompasses 5 broad new changes to the repository:
    - Mock LLM response server: 
        - Path: `backend/mock_model/mock_llm_server.py`
        - Serves a canned response to test the widget rendering, so that you don't have to import an actual model or external LLM. 
        - Also in charge of sending the SSE events, which would come from an external API in production.
    
    - WebSocket Server:
        - Path: `backend/open_webui/socket/live_session_widget.py`
        - Endpoints for the chat presence and session status events

    - API:
        - Path: `src/lib/apis/live_session_widget`
        - Functions for the front end to parse and dispatch events, separated into SSE and WebSocket domains.
        - Tests for parsers are in this folder.

    - Stores:
        - Path: `src/lib/stores/liveSessionWidget.ts`
        - Svelte stores for reactive data for widget state, as well as reducer functions to mutate that state based on dispatched events
        - Separated broadly into SSE and WebSocket domains.
        - Tests for reducers are in this folder. 

    - Component:
        - Path: `src/lib/components/chat/Messages/LiveSessionWidget.svelte`
        - Actual custom component that displays everything.

- Besides this, minor changes were made to some existing components and files for integration.

## Main Decisions, Trade-offs, and Production Needs
- First and most important thing I noticed was that the widget scope is a bit awkward: SSE events are per message, but WebSocket events are per chat room. This forced me to split some functionality between my custom component (message level) and parent components (namely, Chat.svelte) for some WebSocket functionality. 
    - Trade off I made was to separate WebSocket and SSE event logic basically everywhere; different parsers and reducers, stores; APIs, etc. They only come together in the component. The single component obscures the fact that the two scopes are different, but allows for easier viewing of all metrics and steps. I split things to keep scopes as independent as possible. 
        - For production, these should be separated into two separate widgets. 
- SSE events are fake and don't match the canned response
    - In production, there's no case where your widget would continue running steps after your response was done generating, but here I just set some arbitrary delays so the widget can continue processing even after the message is done generating. This is done to simplify things and not worry about synchronizing the events with the fake LLM response in the backend.
- Aborting the generation is treated as an error.
    - To allow users to see the widget error state, manually stopping the generation with the stop button is treated as an error, stopping all widgets immediately. If one event is generating and you queue another message, stopping will abort all of them, so that the currently spinning widget will error and the queued message will not create a widget at all. 
- Simplified connections with backend
    - I see in the code base they have architecture such as a special event emitter that encapsulates socket.IO communication, which is then hit via HTTP endpoint. For simplicity, I directly send events on the WebSocket connection. 
        - Production would match their idioms better, which would be more secure for additional overhead

## Tests and Validation
- Parser and Reducer
    - Run `npx vitest widgetEventParser.test.ts` or `npx vitest widgetEventReducer.test.ts` in their respective repositories for the unit tests. 
- Socket.IO Resubscription
    - Open your browser console
    - Call `__socket.disconnect()` and see the connection indicator turn from green (connected) to red (disconnected)
    - Call `__socket.connect()` abd see the connection reconnect, and the indicator turn green again. Also notice the new "connected ID" message in the console with a new sid for the new websocket connection
-  Switching chats
    - Create one chat and send a message
    - Switch to a different / new chat while the first is still generating and generate a message for the second chat
    - Switch back to the first and notice the state is going where you left it off

## Use of AI
- AI was an indispensible tool for understanding, planning, and executing code throughout the project. 
- AI was critically used to understand concepts and new elements of the stack I was unfamiliar with, get a lowdown of the repository structure, and generate code as I acclimated and learned the frameworks.
- Design decisions were split as such: I asked Claude for recommendations on implementation, cross checked all AI generated code with online documentation (FastAPI, Svelte) and the existing repository structure, asked questions whenever I had doubts about decisions or I didn't understand certain portions, and synthesized the two to come up with the proper code in the proper place.
- An example of this is the current widget structure which is tied to SSE stream lifecycle. Originally when conferring with AI, the recommended approach was to have component mount and dismount deal open and close the SSE stream. I did not like this functionality, which didn't make sense to me as it restarted the stream on every component mount, even when switching chats. Thus, I investigated myself and suggested moving to SSE lifecycle. Similar adjustments and design decisions were made more frequently as I become more familiar with the codebase and stack. 

## Running
- Clone the repo `git clone https://github.com/MyriadRivers/open-webui`
- CD into the repo and checkout the branch 
```
cd open-webui
git checkout live-session-widget
```
- Run the mock LLM backend on port 4000.
    - `uvicorn mock_llm_server:app --port 4000 --reload` from `backend/mock_model` file path
- CD back to the main top level repo. Setup the front end. Make sure you have the right node version installed.
```cp -RPp .env.example .env
npm install
npm run build
npm run dev
```
- Setup the back end. I personally used Conda to set up the virtual environment. 
```
cd backend
# Option A: Conda
conda create --name open-webui python=3.11
conda activate open-webui

# Option B: venv
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```
- Install dependencies and run server.
```
pip install -r requirements.txt -U
sh ./start.sh
```
- Access the front end at `http://localhost:5173`. Refresh if the back end is still loading.
- After creating an account, go to settings on the bottom left and click "connections" under AI. 
- Click "add connection" under "Manage OpenAI API Connections" and type "http://localhost:4000/v1" for the URL, and anything for the API key. This will point to our mock model with the canned response.
- Click save on this modal, and on the connections screen. 
- On the bottom right of the chat UI, click "select model" and select "mock-model-1"
- The UI is ready to be tested!
