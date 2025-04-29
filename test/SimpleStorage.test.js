const SimpleStorage = artifacts.require("SimpleStorage");

contract("SimpleStorage", accounts => {
  let simpleStorage;

  beforeEach(async () => {
    simpleStorage = await SimpleStorage.new();
  });

  it("should store and retrieve a value", async () => {
    const value = 42;
    await simpleStorage.set(value, { from: accounts[0] });
    const storedValue = await simpleStorage.get();
    assert.equal(storedValue, value, "The value was not stored correctly");
  });

  it("should emit DataStored event", async () => {
    const value = 100;
    const result = await simpleStorage.set(value, { from: accounts[0] });
    
    assert.equal(result.logs.length, 1, "should emit one event");
    assert.equal(result.logs[0].event, "DataStored", "should be the DataStored event");
    assert.equal(result.logs[0].args[0].toNumber(), value, "should store the correct value");
  });
});
