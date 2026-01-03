import { render } from 'preact';
import App from './app.tsx';

export { App as CoverMakerApp };

/**
 * Mount the Cover Maker app to a container element
 * @param container - The DOM element to mount the app to
 * @returns A cleanup function to unmount the app
 */
export function mountCoverMaker(container: HTMLElement): () => void {
  render(<App />, container);
  
  return () => {
    render(null, container);
  };
}

export default mountCoverMaker;

