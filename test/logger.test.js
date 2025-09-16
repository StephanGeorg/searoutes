import { expect } from 'chai';

import { Logger, createLogger } from '../src/utils/logger.js';

describe('Logger', () => {
  let originalLog, originalTime, originalTimeEnd;
  let logSpy, timeSpy, timeEndSpy;

  beforeEach(() => {
    // Spy on console methods
    logSpy = [];
    timeSpy = [];
    timeEndSpy = [];

    originalLog = console.log;
    originalTime = console.time;
    originalTimeEnd = console.timeEnd;

    console.log = (...args) => logSpy.push(args);
    console.time = (...args) => timeSpy.push(args);
    console.timeEnd = (...args) => timeEndSpy.push(args);
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalLog;
    console.time = originalTime;
    console.timeEnd = originalTimeEnd;
  });

  describe('Logger class', () => {
    it('should create instance with default options', () => {
      const logger = new Logger();
      expect(logger.options.enableLogging).to.be.false;
      expect(logger.options.prefix).to.equal('');
    });

    it('should accept custom options', () => {
      const logger = new Logger({
        enableLogging: true,
        prefix: 'Test',
      });
      expect(logger.options.enableLogging).to.be.true;
      expect(logger.options.prefix).to.equal('Test');
    });

    it('should not log when logging disabled', () => {
      const logger = new Logger({ enableLogging: false });
      logger.log('test message');
      logger.time('test timer');
      logger.timeEnd('test timer');

      expect(logSpy).to.have.length(0);
      expect(timeSpy).to.have.length(0);
      expect(timeEndSpy).to.have.length(0);
    });

    it('should log when logging enabled', () => {
      const logger = new Logger({ enableLogging: true });
      logger.log('test message');

      expect(logSpy).to.have.length(1);
      expect(logSpy[0][0]).to.equal('test message');
    });

    it('should add prefix to log messages', () => {
      const logger = new Logger({
        enableLogging: true,
        prefix: 'TestModule',
      });
      logger.log('test message');

      expect(logSpy).to.have.length(1);
      expect(logSpy[0][0]).to.equal('[TestModule] test message');
    });

    it('should add prefix to timer labels', () => {
      const logger = new Logger({
        enableLogging: true,
        prefix: 'TestModule',
      });
      logger.time('test timer');
      logger.timeEnd('test timer');

      expect(timeSpy).to.have.length(1);
      expect(timeEndSpy).to.have.length(1);
      expect(timeSpy[0][0]).to.equal('[TestModule] test timer');
      expect(timeEndSpy[0][0]).to.equal('[TestModule] test timer');
    });

    it('should update options', () => {
      const logger = new Logger({ enableLogging: false });
      logger.updateOptions({ enableLogging: true, prefix: 'Updated' });

      expect(logger.options.enableLogging).to.be.true;
      expect(logger.options.prefix).to.equal('Updated');
    });

    it('should create child logger with different prefix', () => {
      const parentLogger = new Logger({
        enableLogging: true,
        prefix: 'Parent',
      });
      const childLogger = parentLogger.createChild('Child');

      expect(childLogger.options.enableLogging).to.be.true;
      expect(childLogger.options.prefix).to.equal('Child');
      expect(parentLogger.options.prefix).to.equal('Parent'); // Parent unchanged
    });
  });

  describe('createLogger function', () => {
    it('should create logger with specified prefix', () => {
      const logger = createLogger('MyModule');
      expect(logger.options.prefix).to.equal('MyModule');
      expect(logger.options.enableLogging).to.be.false; // Default
    });

    it('should create logger with additional options', () => {
      const logger = createLogger('MyModule', { enableLogging: true });
      expect(logger.options.prefix).to.equal('MyModule');
      expect(logger.options.enableLogging).to.be.true;
    });

    it('should create functional logger', () => {
      const logger = createLogger('TestModule', { enableLogging: true });
      logger.log('functional test');

      expect(logSpy).to.have.length(1);
      expect(logSpy[0][0]).to.equal('[TestModule] functional test');
    });
  });

  describe('real world usage', () => {
    it('should work like CoordinateLookup logger', () => {
      const logger = createLogger('CoordinateLookup', { enableLogging: true });

      logger.log('Building spatial coordinate index...');
      logger.time('Coordinate indexing');
      // Simulate some work
      logger.timeEnd('Coordinate indexing');
      logger.log('Indexed 1000 coordinate vertices');

      expect(logSpy).to.have.length(2);
      expect(logSpy[0][0]).to.equal('[CoordinateLookup] Building spatial coordinate index...');
      expect(logSpy[1][0]).to.equal('[CoordinateLookup] Indexed 1000 coordinate vertices');

      expect(timeSpy).to.have.length(1);
      expect(timeSpy[0][0]).to.equal('[CoordinateLookup] Coordinate indexing');

      expect(timeEndSpy).to.have.length(1);
      expect(timeEndSpy[0][0]).to.equal('[CoordinateLookup] Coordinate indexing');
    });

    it('should work like SeaRoute logger', () => {
      const logger = createLogger('SeaRoute', { enableLogging: true });

      logger.log('Building network infrastructure...');
      logger.time('Default pathfinder');
      logger.timeEnd('Default pathfinder');
      logger.log('SeaRoute initialization completed successfully');

      expect(logSpy).to.have.length(2);
      expect(logSpy[0][0]).to.equal('[SeaRoute] Building network infrastructure...');
      expect(logSpy[1][0]).to.equal('[SeaRoute] SeaRoute initialization completed successfully');
    });
  });
});
