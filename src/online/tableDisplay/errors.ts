export class TableDisplayProjectionErrorV1 extends Error {
  public constructor() {
    super('Table Display projection is unavailable');
    this.name = 'TableDisplayProjectionErrorV1';
  }
}
