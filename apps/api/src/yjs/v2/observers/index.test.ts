import { MainObserver } from './index.js'
import { IBlocksObserver } from './blocks/index.js'
import { IRunAllObserver } from './run-all.js'

describe('MainObserver', () => {
  let mainObserver: MainObserver
  let blocksObserver: jest.Mocked<IBlocksObserver>
  let runAllObserver: jest.Mocked<IRunAllObserver>

  beforeEach(() => {
    blocksObserver = {
      start: jest.fn(),
      stop: jest.fn(),
      isIdle: jest.fn(),
    }
    runAllObserver = {
      start: jest.fn(),
      stop: jest.fn(),
      isIdle: jest.fn(),
    }
    mainObserver = new MainObserver(
      'workspace-id',
      'document-id',
      blocksObserver,
      runAllObserver
    )
  })

  describe('isIdle', () => {
    it('should return true when both blocksObserver and runAllObserver are idle', () => {
      blocksObserver.isIdle.mockReturnValue(true)
      runAllObserver.isIdle.mockReturnValue(true)

      expect(mainObserver.isIdle()).toEqual(true)
      expect(blocksObserver.isIdle).toHaveBeenCalled()
      expect(runAllObserver.isIdle).toHaveBeenCalled()
    })

    it('should return false otherwise', () => {
      blocksObserver.isIdle.mockReturnValue(false)
      runAllObserver.isIdle.mockReturnValue(true)
      expect(mainObserver.isIdle()).toEqual(false)

      blocksObserver.isIdle.mockReturnValue(false)
      runAllObserver.isIdle.mockReturnValue(false)
      expect(mainObserver.isIdle()).toEqual(false)

      blocksObserver.isIdle.mockReturnValue(false)
      runAllObserver.isIdle.mockReturnValue(true)
      expect(mainObserver.isIdle()).toEqual(false)
    })
  })

  describe('start', () => {
    it('should start blocksObserver', () => {
      mainObserver.start()

      expect(blocksObserver.start).toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('should stop blocksObserver', () => {
      mainObserver.stop()

      expect(blocksObserver.stop).toHaveBeenCalled()
    })
  })
})
