export class OnlineDisplayPairingErrorV1 extends Error {
  constructor() {
    super('Display pairing is unavailable');
    this.name = 'OnlineDisplayPairingErrorV1';
    Object.freeze(this);
  }
}

export class PersonalWorkbenchActionBindingErrorV1 extends Error {
  constructor() {
    super('Personal Workbench action binding is unavailable');
    this.name = 'PersonalWorkbenchActionBindingErrorV1';
    Object.freeze(this);
  }
}
