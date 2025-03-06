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

// Optional parameter for maximum reconnection attempts (default is 0 - infinite attempts)
this.qsys.connect("192.168.1.100", 5);

// Monitor connection status
this.qsys.getConnectionStatus().subscribe((status) => {
  if (status.connected) {
    console.log("Connected to Q-Sys Core");
    console.log("Engine status:", status.engineStatus);
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
    console.log("Platform:", status.Platform);
    console.log("Status:", status.Status.String);
  } else {
    console.log("No engine status available");
  }
});
```

### Working with Components

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
const fader = mixer?.getControl("fader1");
if (fader) {
  // Set value directly
  await fader.setValue(0.8);

  // With ramping (time in seconds)
  await fader.rampValue(0.5, 2.5);

  // Set position (for controls that support it, values between 0-1)
  await fader.setPosition(0.5); // 50%

  // With ramping
  await fader.rampPosition(0.75, 3.0); // Ramp to 75% over 3 seconds

  // For trigger controls
  if (fader.type === "Trigger") {
    await fader.trigger();
  }
}
```

### Subscribing to Control Changes

```typescript
// Subscribe to updates for a specific control
const mixer = await this.qsys.getComponent("MainMixer");
const fader = mixer?.getControl("fader1");
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

  // Make sure to subscribe to receive updates
  await mixer.subscribe();
}
```

### Using Direct Commands

```typescript
// Send a command and get the response
try {
  const response = await this.qsys.sendCommandAsync("Component.GetComponents", {});
  console.log("Components:", response);
} catch (error) {
  console.error("Error:", error);
}

// Send a notification (no response)
this.qsys.sendNotification("NoOp", {});
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
