**Prompt:**

Act as an expert WebGL game developer specializing in Three.js and an advanced physics engine like Ammo.js or Cannon-es (which supports breakable constraints). Your task is to create a 3D web-based game using HTML, CSS, and modular JavaScript that simulates a traditional Newari chariot procession.

The game is divided into two distinct phases: **Phase 1: The Builder (Workshop)** and **Phase 2: The Procession (Physics Simulation)**.

**General Technical Requirements:**

- **Tech Stack:** HTML5, CSS3, Vanilla JavaScript (ES6 modules).
- **Graphics:** Three.js for 3D rendering, lighting, and camera controls.
- **Physics:** Ammo.js or Cannon-es. The physics engine MUST support joint/constraint stress limits so that objects can break apart piece by piece under extreme force.
- **Structure:** Provide the code in modular blocks (index.html, main.js, physics.js, builder.js, controls.js).

**Phase 1: The Chariot Builder (3D Interface)**
Instead of standard HTML menus, build a fully 3D interactive interface for the selection process.

- **3D UI Navigation:** The user navigates the building options using the Up and Down arrow keys to cycle through chariot parts, and Left/Right keys to cycle through material/shape options. The camera should smoothly pan and focus on the specific part of the chariot currently being customized.
- **Visual Reference:** Generate the 3D models by studying the chariot reference images stored in the workspace images folder, especially the structural skeleton in "images/image.png", the tall top-heavy tower in "images/image2.png", and the additional wheel and detail plates in the other files under "images/" (such as "image copy 2.png" through "image copy 8.png"). Use these references to match the timber frame proportions, wheel geometry, and decorative tower silhouette seen in the real procession chariots.
- **Component & Material Selection:** Each wood type must carry specific weight, flexibility, and durability (joint breaking threshold) modifiers in the physics engine:
- **Dhama (Central Spine):** Base chassis. User selects _Sau (Saur)_ timber.
- **Wheels (The 4 Bhairavs):** User selects _San-nan_ wood. Modeled as large cylinders with high mass, attached to the Dhama using hinge constraints.
- **Superstructure (Upper Tower):** User selects _Falnat_ wood for the tall upper tower and _Lakuri_ wood for the smaller pillars. This drastically raises the center of mass.
- **Brakes:** User selects _Maeel_ wood. This dictates the stopping power and friction.

- **Assembly Physics:** All parts must be connected using physics constraints (e.g., lock constraints or point-to-point constraints) with defined breaking thresholds based on the wood types chosen.

**Phase 2: The Procession (Simulated Rope Pulling)**

- **Environment (The Route):** Create a simple, low-poly 3D track representing the Upper City (Thaneya / Northern Route) of Kathmandu, approximately 1.8 km long in game scale. The track should feature waypoints (checkpoints) in this specific order: Pyaphal -> Yatkha -> Naradevi -> Tengal -> Nyokha -> Bangemuda -> Asan -> Kel Tol -> Indra Chowk -> Makhan -> Basantapur. Include uneven terrain, slight bumps, and sharp turns.
- **Control Mechanism:** The user does NOT drive the chariot like a car. Instead, they manage a virtual team of devotees pulling the ropes attached to the Dhama.
- Controls should dictate the _amount of force_ the pulling team applies (e.g., holding 'W' commands the team to heave, building up force).
- The simulation must accurately model real-life speed and massive momentum. Heavy chariots take time to start moving and take immense effort (and time) to stop.
- Turning requires balancing pulling forces on the left vs. right ropes.

- **Failure Condition (Piece-by-Piece Collapse):** If the user allows the chariot to build up too much momentum and hits a bump, corners too aggressively, or applies the _Maeel_ wood brakes too suddenly, the physics constraints connecting the chariot parts will experience extreme stress.
- If stress exceeds the durability of the selected wood constraint, the joint breaks.
- The chariot must collapse piece-by-piece dynamically (e.g., the top of the Falnat wood tower snaps off and falls, or a San-nan wheel breaks off its axle).

- **Goal:** Successfully manage the team's pulling momentum to navigate the chariot through all Thaneya route waypoints to Basantapur without the chariot breaking apart or tipping over.

Please provide the boilerplate HTML, the CSS for the UI overlay (to show momentum/stress meters), and the foundational JavaScript code to set up the Three.js scene, the physics world (with breakable constraints), the 3D Up/Down arrow selection logic for Phase 1, and the pulling-force momentum logic for Phase 2. Include comments explaining how to expand the 3D meshes to match the provided reference images.
