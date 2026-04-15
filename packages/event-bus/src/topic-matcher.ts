/**
 * TopicMatcher provides pattern-based matching for event topics.
 *
 * Rules:
 * - Exact match: `sensor.camera` matches `sensor.camera`
 * - `*` matches exactly one segment: `sensor.*` matches `sensor.camera`
 *   but NOT `sensor.camera.frame`
 * - `**` matches one or more segments: `sensor.**` matches `sensor.camera`
 *   and `sensor.camera.frame`
 */
export class TopicMatcher {
  static matches(pattern: string, topic: string): boolean {
    if (pattern === topic) {
      return true;
    }

    const patternSegments = pattern.split('.');
    const topicSegments = topic.split('.');

    return TopicMatcher.matchSegments(patternSegments, 0, topicSegments, 0);
  }

  private static matchSegments(
    pattern: string[],
    pi: number,
    topic: string[],
    ti: number,
  ): boolean {
    // Both exhausted — match
    if (pi === pattern.length && ti === topic.length) {
      return true;
    }

    // Pattern exhausted but topic has remaining segments — no match
    if (pi === pattern.length) {
      return false;
    }

    const seg = pattern[pi];

    if (seg === '**') {
      // `**` must match one or more segments
      if (ti >= topic.length) {
        return false;
      }
      // Try consuming 1..N remaining topic segments
      for (let consume = 1; consume <= topic.length - ti; consume++) {
        if (TopicMatcher.matchSegments(pattern, pi + 1, topic, ti + consume)) {
          return true;
        }
      }
      return false;
    }

    // Topic exhausted but pattern still has non-** segments — no match
    if (ti === topic.length) {
      return false;
    }

    if (seg === '*') {
      // `*` matches exactly one segment
      return TopicMatcher.matchSegments(pattern, pi + 1, topic, ti + 1);
    }

    // Literal match
    if (seg === topic[ti]) {
      return TopicMatcher.matchSegments(pattern, pi + 1, topic, ti + 1);
    }

    return false;
  }
}
