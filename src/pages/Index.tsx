import { GameCanvas } from "@/components/GameCanvas";
import { ParallaxBackground } from "@/components/ParallaxBackground";

const Index = () => {
  return (
    <main className="w-screen h-screen bg-background overflow-hidden">
      <ParallaxBackground>
        <GameCanvas />
      </ParallaxBackground>
    </main>
  );
};

export default Index;
