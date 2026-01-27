import { ReadyEvent, ReadyEventType } from '../../lib/types';

// ============== Ready Event System ==============
interface ReadyResolver {
  resolve: () => void;
  reject: (reason: string) => void;
  requiredEvents: Set<ReadyEventType>;
  receivedEvents: Set<ReadyEventType>;
  timeout?: ReturnType<typeof setTimeout>;
}

const readyResolvers = new Map<number, ReadyResolver>();

// 注意：webNavigation.onCommitted 监听器在 Navigation Tracking 部分
export function waitForPageReady(tabId: number, requiredEvents: ReadyEventType[] = ['PAGE_FULLY_READY'], timeoutMs: number = 6000): Promise<void> {
  // 如果已有等待中的 resolver，先清理它
  const existingResolver = readyResolvers.get(tabId);
  if (existingResolver) {
    if (existingResolver.timeout) clearTimeout(existingResolver.timeout);
    existingResolver.reject('Cancelled by new ready wait request');
    readyResolvers.delete(tabId);
  }

  return new Promise((resolve, reject) => {
    const resolver: ReadyResolver = {
      resolve,
      reject,
      requiredEvents: new Set(requiredEvents),
      receivedEvents: new Set(),
      timeout: setTimeout(() => {
        readyResolvers.delete(tabId);
        const msg = `Page ready timeout (${timeoutMs}ms) for tab ${tabId}. Required: ${requiredEvents.join(', ')}`;
        console.error(`[Pilot Engine] ${msg}`);
        reject(msg);
      }, timeoutMs)
    };

    readyResolvers.set(tabId, resolver);
    console.log(`[Pilot Engine] Waiting for page ready in Tab ${tabId}:`, requiredEvents);
  });
}

export function handleReadyEvent(event: ReadyEvent) {
  const { tabId, type } = event;
  console.log(`[Pilot Engine] Ready event received: ${type} for Tab ${tabId}`);

  const resolver = readyResolvers.get(tabId);
  if (!resolver) {
    console.log(`[Pilot Engine] No resolver found for Tab ${tabId}, ignoring event`);
    return;
  }

  resolver.receivedEvents.add(type);
  console.log(`[Pilot Engine] Tab ${tabId} - required: [${Array.from(resolver.requiredEvents)}], received: [${Array.from(resolver.receivedEvents)}]`);

  // 检查是否所有必需的事件都已收到
  const allReceived = Array.from(resolver.requiredEvents).every(e => resolver.receivedEvents.has(e));

  if (allReceived) {
    if (resolver.timeout) clearTimeout(resolver.timeout);
    readyResolvers.delete(tabId);
    console.log(`[Pilot Engine] Page fully ready in Tab ${tabId}`);
    resolver.resolve();
  }
}

