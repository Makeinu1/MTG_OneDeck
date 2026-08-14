export class PersonalWorkbenchProjectionErrorV1 extends Error {
  public constructor() {
    super('Personal Workbench projection is unavailable');
    this.name = 'PersonalWorkbenchProjectionErrorV1';
  }
}
