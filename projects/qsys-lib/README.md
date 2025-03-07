# QsysLib

QsysLib is an Angular service for communicating with QSC Q-Sys cores over WebSocket using the QRC (Q-Sys Remote Control) protocol.

## Installation

Install the library from npm:

```bash
npm install @mikejobson/qsys-lib
```

You can view the package on npm here: [https://www.npmjs.com/package/@mikejobson/qsys-lib](https://www.npmjs.com/package/@mikejobson/qsys-lib)

## Setup

1. Import the `QsysLibModule` in your app module:

```typescript
import { QsysLibModule } from "@mikejobson/qsys-lib";

@NgModule({
  imports: [
    QsysLibModule,
    // other imports
  ],
  // ...
})
export class AppModule {}
```

2. Inject the `QsysLibService` in your components:

```typescript
import { QsysLibService } from "@mikejobson/qsys-lib";

@Component({
  // ...
})
export class YourComponent {
  constructor(private qsys: QsysLibService) {}
}
```

## Basic Usage

### Connecting to a Q-Sys Core

```typescript
// Connect to a Q-Sys Core with IP address or hostname
this.qsys.connect("192.168.1.100");
// Formats to "wss://192.168.1.100/qrc"

// Connect using a path - uses the current host with the specified path
this.qsys.connect("/api/qrc");
// Formats to "wss://current.host.com/api/qrc"

// Specify the full WebSocket URL directly
this.qsys.connect("wss://my-qsys-core.example.com/qrc");

// Use the static helper method to format the URL
const wsUrl = QsysLibService.formatWebsocketUrl("192.168.1.100");
this.qsys.connect(wsUrl);

// Get the current WebSocket URL
console.log(this.qsys.websocketUrl);

// Set the WebSocket URL directly (doesn't connect automatically)
this.qsys.websocketUrl = "wss://another-core.example.com/qrc";
this.qsys.connect(this.qsys.websocketUrl);

// Optional parameter for maximum reconnection attempts (default is 0 - infinite attempts)
this.qsys.connect("192.168.1.100", 5);

// Monitor connection status
this.qsys.getConnectionStatus().subscribe((status) => {
  if (status.connected) {
    console.log("Connected to Q-Sys Core");
    console.log("Engine status:", status.engineStatus);

    // Check if the design has changed since last connection
    if (status.newDesign) {
      console.log("The Q-Sys design has changed, refreshing components");
      // Reload your components here as needed
    }
  } else {
    console.log("Disconnected from Q-Sys Core");
    if (status.noReconnect) {
      console.log("No reconnection will be attempted");
    }
  }
});

// Disconnect when done
this.qsys.disconnect();
```

### Getting Engine Status

```typescript
this.qsys.getEngineStatus().subscribe((status) => {
  if (status) {
    console.log("Design name:", status.DesignName);
    console.log("Design Code:", status.DesignCode);
    console.log("Platform:", status.Platform);
    console.log("Status:", status.Status.String);
  } else {
    console.log("No engine status available");
  }
});
```

### Working with Components

When the service connects to the api for the first time, the service requests all available components and controls from the websocket connection.
The components are cached and monitored using a default change group named 'auto'. This is also set to poll after controls are changed locally, and listen at a default rate for external changes.

If the connection drops it should re-establish the change groups automatically as long as the design code is the same. If the design code has changed, note that all objects cached are removed and you should get the component and controls again. The old objects of these will not update otherwise or may be non-existant in the design.

```typescript
// Get all components in the design
const components = await this.qsys.getAllComponents();
components.forEach((component) => {
  console.log(`Component: ${component.name}, Type: ${component.type}`);
});

// Get a specific component by name
const mixer = await this.qsys.getComponent("MainMixer");
if (mixer) {
  console.log(`Found mixer: ${mixer.name}`);

  // Get component properties
  console.log("Properties:", mixer.properties);

  // Get controls
  mixer.controls.forEach((control) => {
    console.log(`Control: ${control.name}, Type: ${control.type}, Value: ${control.value}`);
  });

  // Get a specific control
  const fader = mixer.getControl("fader1");
  if (fader) {
    console.log(`Current fader value: ${fader.value}`);
  }
}
```

### Controlling Components

```typescript
// Change a control's value
const mixer = await this.qsys.getComponent("MainMixer");
const gain = mixer?.getControl("input.1.gain");
if (gain) {
  // Set value directly to -20dB
  await gain.setValue(-20);

  // With ramping (time in seconds), sets value to 0dB over 2.5 seconds
  await gain.rampValue(0, 2.5);

  // Set position (for controls that support it, values between 0-1) of gain to half way
  await gain.setPosition(0.5); // 50%

  // With ramping
  await gain.rampPosition(0.75, 3.0); // Ramp to 75% over 3 seconds
}

const mute = mixer?.getControl("input.1.mute");
if (mute) {
  // Read the mute value as a Boolean
  var muteValue: Boolean = gain.value;

  // Set the value
  await mute.setValue(true);
}
```

### Subscribing to Control Changes

```typescript
// Subscribe to updates for a specific control
const mixer = await this.qsys.getComponent("MainMixer");
const fader = mixer?.getControl("input.1.gain");
if (fader) {
  fader.updated.subscribe((control) => {
    console.log(`Fader updated: ${control.value}`);
  });

  // Subscribe to all controls in a component
  mixer.updated.subscribe((controls) => {
    console.log(
      "Updated controls:",
      controls.map((c) => c.name)
    );
  });
}
```

### Using Direct Commands

Direct commands allow asynchronous comms directly to the QRC protocol rather than using the object methods above.

Note these methods don't return object classes with notifications and control methods, but rather just the data which may be easier for simple tasks.

```typescript
// Send a command and get the response
try {
  const response = await this.qsys.sendCommandAsync("Component.GetComponents", {});
  console.log("Components:", response);
} catch (error) {
  console.error("Error:", error);
}

// You can also use the getComponents method to receive data for each component.
try {
  const response = await this.qsys.getComponents();
  console.log("Components:", response);
} catch (error) {
  console.error("Error:", error);
}

// Alternatively you can include the controls in there also
try {
  const response = await this.qsys.getComponents(true);
  console.log("Components with controls:", response);
} catch (error) {
  console.error("Error:", error);
}

// Get controls for a specific component
try {
  const controls = await this.qsys.getControls("MainMixer");
  console.log("Controls:", controls);

  // Controls are sorted by name and contain properties like:
  // Name, Type, Value, ValueMin, ValueMax, String, Position, Direction
} catch (error) {
  console.error("Error:", error);
}

// Set a component's control value directly
try {
  // Set a gain control to -10 dB
  await this.qsys.setComponentValue("MainMixer", "input.1.gain", -10);

  // Set a gain control to -20 dB with a 2 second ramp
  await this.qsys.setComponentValue("MainMixer", "input.1.gain", -20, 2);

  // Set a mute control to true
  await this.qsys.setComponentValue("MainMixer", "input.1.mute", true);
} catch (error) {
  console.error("Error:", error);
}

// Set a component's position directly (values between 0-1)
try {
  // Set a fader to 50%
  await this.qsys.setComponentPosition("MainMixer", "input.1.gain", 0.5);

  // Set a fader to 75% with a 3 second ramp
  await this.qsys.setComponentPosition("MainMixer", "input.1.gain", 0.75, 3);
} catch (error) {
  console.error("Error:", error);
}
```

### Change Groups

```typescript
// Create a change group with specific controls
const groupId = "myGroup";
await this.qsys.changeGroupAddControls(groupId, "MainMixer", ["fader1", "mute1"]);

// Poll the change group manually
const changes = await this.qsys.changeGroupPoll(groupId);
console.log("Changes:", changes);

// Set up auto-polling (rate in seconds)
await this.qsys.changeGroupAutoPoll(groupId, 0.5);

// Listen for change group updates
this.qsys.getChangeGroupUpdates().subscribe((update) => {
  if (update.changeGroupId === groupId) {
    console.log("Updates:", update.changes);
  }
});
```

## Building and Publishing

This library is automatically built and published to npm using GitHub Actions when changes are pushed to the main branch.

### Automated Publishing Workflow

1. When changes are pushed to the `main` branch that affect files in the `projects/qsys-lib/` directory, a GitHub Actions workflow is triggered.
2. The workflow builds the library and checks if the version in `package.json` has been incremented.
3. If the version has been updated, the workflow automatically publishes the new version to npm.

### Contributing Changes

If you're contributing changes to this library:

1. Make your changes in a feature branch
2. Update the version in `projects/qsys-lib/package.json` according to [semver](https://semver.org/) guidelines:
   - Patch version for backwards compatible bug fixes (0.2.2 → 0.2.3)
   - Minor version for backwards compatible new features (0.2.2 → 0.3.0)
   - Major version for breaking changes (0.2.2 → 1.0.0)
3. Create a pull request targeting the `main` branch
4. Once merged, the GitHub Actions workflow will automatically publish the new version

### Manual Building

To build the library locally for testing:

```bash
ng build qsys-lib
```

This command will compile the library, and the build artifacts will be placed in the `dist/` directory.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
