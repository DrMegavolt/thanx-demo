Take home challenge


Summary:
The challenge is to implement a basic rewards redemption web app that allows a user to do the following:
View their current reward points balance.
Browse available rewards.
Redeem rewards using their points.
See a history of their reward redemptions.

Tech Stack:
At Thanx, our primary technologies are React on the frontend, Ruby on Rails on the backend, and MySQL for the database. For ease of setup and evaluation, please adhere to the following:
Backend: Ruby on Rails
Ruby 3.4.3
Rails 8.0.2
Frontend: React (TypeScript preferred, JavaScript acceptable)
React > 16
Database: SQLite (preferred for simplicity)



Core Requirements:
Backend API:
Implement RESTful endpoints for the following:
Retrieve a user’s current points balance
Get a list of available rewards
Allow users to redeem a reward
Retrieve a user’s redemption history

Data Persistence:
Use a database of your choice (SQLite preferred) and design the schema as you see fit to support the required functionality.

Interface:
Implement a simple interface to interact with the backend API. This may be:
A web-based interface (preferred, especially if your focus is on frontend development - see the Tech Stack above for details), or
A command-line interface (CLI)



Setup & Running the Application:
Please include clear, straightforward instructions for running the application locally. We prefer minimal, manual setup without complex tooling.
Backend (example):
bundle install
rails db:setup
rails s
Frontend (example):
npm install
npm run start
Equivalent commands (e.g., yarn, npm run dev) are acceptable, but please avoid only including more complex startup scripts or requirements such as Docker, Overmind, or similar orchestration tools.

AI:
We expect you’ll use an AI coding agent for this challenge, and we want to see how you worked with it, not just the code you end up with.
Please include the full session log your tool produces, not a summary written after the fact.
If you use Claude Code, include the raw session file, the JSONL transcript containing every prompt, response, and tool call.
If you use a different tool (Cursor, Copilot, Codex CLI, etc), include whatever native session or chat history export it provides. If your tool doesn’t produce an exportable log, keep a plain text file of your prompts as you go.
Save this as ai-session/ at the root of your submission (a folder is fine if you used multiple sessions or tools).
This is a required part of the submission, not optional supporting material. We’re evaluating your judgment working with AI, including where you caught it making mistakes or pushed back on its suggestions, alongside the code itself.

Documentation:
Provide clear documentation on how to set up and run the application.

Submission:
Please submit via a zip file to the provided greenhouse link (avoid formats like rar). Include the ai-session/ folder. Do not include dependencies (like node modules).
