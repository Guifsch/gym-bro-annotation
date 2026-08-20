import { useRef } from 'react';
import type { ScrollView, View } from 'react-native';

/** Powers a "jump to category" bar: ref-plumbing to measure each category group's position
 * within the ScrollView (via `measureLayout`) and scroll it into view.
 *
 * Under the New Architecture (Fabric), `measureLayout`'s ancestor argument must be a ref to a
 * native host component — a plain ScrollView ref (or a node handle from the legacy
 * `findNodeHandle`) is a composite component and throws "ref.measureLayout must be called with
 * a ref to a native component". `getNativeScrollRef()` returns the actual native host instance
 * backing the ScrollView, which is what `measureLayout` needs. */
export function useCategoryScroll() {
  const scrollViewRef = useRef<ScrollView>(null);
  const groupRefs = useRef<Record<string, View | null>>({});

  function setGroupRef(categoriaId: string) {
    return (el: View | null) => {
      groupRefs.current[categoriaId] = el;
    };
  }

  function scrollToGroup(categoriaId: string) {
    const node = groupRefs.current[categoriaId];
    const scrollNode = scrollViewRef.current;
    if (!node || !scrollNode) return;
    const nativeScrollRef = scrollNode.getNativeScrollRef();
    if (!nativeScrollRef) return;
    node.measureLayout(
      nativeScrollRef,
      (_x, y) => scrollNode.scrollTo({ y: Math.max(0, y - 8), animated: true }),
      () => {}
    );
  }

  return { scrollViewRef, setGroupRef, scrollToGroup };
}
