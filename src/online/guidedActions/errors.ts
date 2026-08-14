export class OnlineGuidedActionsErrorV1 extends Error {
  constructor() {
    super('Online guided actions are unavailable');
    this.name = 'OnlineGuidedActionsErrorV1';
    Object.freeze(this);
  }
}

export class OnlineGuidedActionBindingErrorV1 extends Error {
  constructor() {
    super('Online guided action binding is unavailable');
    this.name = 'OnlineGuidedActionBindingErrorV1';
    Object.freeze(this);
  }
}
