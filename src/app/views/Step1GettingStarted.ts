/**
 * Step 1: Getting Started
 */

export function renderStep1(): string {
  return `
    <div class="wizard-step">
      <h2 class="wizard-step-title">Getting Started</h2>
      <p class="wizard-step-description">
        Think of your app in terms of what information (or data) you need to see
        and how you need to interact with it.
      </p>
      <p class="wizard-step-description">
        Begin by crafting one or more sentences in the form "I need to [action] [data]",
        where the action can be any way that you might view or interact with the data. And 
        the data can be unchanging information (like a set of instructions that remain the same 
        for all users), or data that you get from your pod (like a list of todo's that you saved previously),
        or data from anywhere else on the internet.  
      </p>
      <p class="wizard-step-description">
        Some examples are:
      </p>
      <ul class="wizard-step-description">
        <li>I need to view my todo list.</li>
        <li>I need to search my contacts.</li>
        <li>I need to get the weather forecast.</li>
      </ul>
      <p class="wizard-step-description">
        If you need help getting started, try answering these questions:
        <ul class="wizard-step-description">
          <li>What data or information do you need to see?</li>
          <li>What do you need to be able to do with that data?</li>
          <li>Is the information static or dynamic? If it's dynamic,
          where will you be retrieving it from: your pod, an API, or somewhere else?</li>
        </ul>
      </p>
    </div>
  `;
}
