"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

interface Antibody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  color: "blue" | "green";
  alpha: number;
}

interface Antigen {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulse: number;
  pulseSpeed: number;
  alpha: number;
}

interface Substrate {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  alpha: number;
}

export function ParticleNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const antibodiesRef = useRef<Antibody[]>([]);
  const antigensRef = useRef<Antigen[]>([]);
  const substratesRef = useRef<Substrate[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initElements();
    };

    const initElements = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Fewer antibodies - more spread out
      const antibodyCount = Math.floor((width * height) / 120000);
      antibodiesRef.current = [];
      for (let i = 0; i < antibodyCount; i++) {
        antibodiesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.003,
          scale: Math.random() * 0.3 + 0.5,
          color: Math.random() > 0.5 ? "blue" : "green",
          alpha: Math.random() * 0.3 + 0.2,
        });
      }

      // Fewer antigens
      const antigenCount = Math.floor((width * height) / 150000);
      antigensRef.current = [];
      for (let i = 0; i < antigenCount; i++) {
        antigensRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.1,
          vy: (Math.random() - 0.5) * 0.1,
          radius: Math.random() * 4 + 3,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.015 + 0.01,
          alpha: Math.random() * 0.4 + 0.2,
        });
      }

      // Fewer substrates
      const substrateCount = Math.floor((width * height) / 180000);
      substratesRef.current = [];
      for (let i = 0; i < substrateCount; i++) {
        substratesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: Math.random() * 0.005 + 0.002,
          scale: Math.random() * 0.3 + 0.4,
          alpha: Math.random() * 0.3 + 0.15,
        });
      }
    };

    const drawAntibody = (ctx: CanvasRenderingContext2D, antibody: Antibody) => {
      // Check distance from mouse for glow effect
      const dx = antibody.x - mouseRef.current.x;
      const dy = antibody.y - mouseRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const isHovered = distance < 100;
      const hoverIntensity = isHovered ? Math.max(0, 1 - distance / 100) : 0;

      ctx.save();
      ctx.translate(antibody.x, antibody.y);
      ctx.rotate(antibody.rotation);
      ctx.scale(antibody.scale, antibody.scale);

      const colors = {
        blue: { main: "#3b82f6", bright: "#60a5fa", brightest: "#93c5fd", glow: "#3b82f6" },
        green: { main: "#22c55e", bright: "#4ade80", brightest: "#86efac", glow: "#22c55e" },
      };
      const color = colors[antibody.color];

      ctx.globalAlpha = isDark ? antibody.alpha * 1.2 : antibody.alpha;
      
      // Set up intense glow when hovered
      if (isHovered) {
        ctx.globalAlpha = 1;
        ctx.shadowColor = color.brightest;
        ctx.shadowBlur = 30 + hoverIntensity * 40;
      }

      ctx.lineWidth = isHovered ? 4 : 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = isHovered ? color.brightest : color.main;

      // Draw multiple times for intense glow effect when hovered
      const passes = isHovered ? 3 : 1;
      for (let p = 0; p < passes; p++) {
        if (isHovered && p > 0) {
          ctx.shadowBlur = (3 - p) * 20 * hoverIntensity;
        }

        // Stem
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.lineTo(0, -3);
        ctx.stroke();

        // Left arm
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(-10, -16);
        ctx.stroke();

        // Right arm
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(10, -16);
        ctx.stroke();
      }

      // Binding sites - extra bright when hovered
      ctx.fillStyle = isHovered ? color.brightest : color.bright;
      if (isHovered) {
        ctx.shadowColor = color.brightest;
        ctx.shadowBlur = 25;
      }
      ctx.beginPath();
      ctx.arc(-10, -16, isHovered ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, -16, isHovered ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawAntigen = (ctx: CanvasRenderingContext2D, antigen: Antigen) => {
      // Check distance from mouse for glow effect
      const dx = antigen.x - mouseRef.current.x;
      const dy = antigen.y - mouseRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const isHovered = distance < 80;
      const hoverIntensity = isHovered ? Math.max(0, 1 - distance / 80) : 0;

      antigen.pulse += antigen.pulseSpeed;
      const pulseRadius = antigen.radius + Math.sin(antigen.pulse) * 1;
      const displayRadius = isHovered ? pulseRadius * 1.5 : pulseRadius;

      ctx.save();
      ctx.globalAlpha = isDark ? antigen.alpha * 1.3 : antigen.alpha;

      if (isHovered) {
        ctx.globalAlpha = 1;
        
        // Draw multiple bright circles for intense glow
        for (let i = 3; i >= 0; i--) {
          ctx.beginPath();
          ctx.arc(antigen.x, antigen.y, displayRadius + i * 8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(253, 224, 71, ${0.3 - i * 0.07})`;
          ctx.shadowColor = "#fde047";
          ctx.shadowBlur = 40 - i * 8;
          ctx.fill();
        }
      }

      // Subtle outer glow (always present, stronger when hovered)
      const gradient = ctx.createRadialGradient(
        antigen.x, antigen.y, 0,
        antigen.x, antigen.y, displayRadius * 2
      );
      gradient.addColorStop(0, isHovered ? "rgba(253, 224, 71, 0.9)" : "rgba(251, 191, 36, 0.5)");
      gradient.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(antigen.x, antigen.y, displayRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core - bright glowing sphere
      ctx.beginPath();
      ctx.arc(antigen.x, antigen.y, displayRadius, 0, Math.PI * 2);
      
      if (isHovered) {
        ctx.shadowColor = "#fef08a";
        ctx.shadowBlur = 50;
        ctx.fillStyle = "#fef9c3"; // Very bright yellow/white
      } else {
        ctx.fillStyle = isDark ? "#fcd34d" : "#fbbf24";
      }
      ctx.fill();

      // Add bright center highlight when hovered
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(antigen.x, antigen.y, displayRadius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fffbeb";
        ctx.shadowBlur = 30;
        ctx.fill();
      }

      ctx.restore();
    };

    const drawSubstrate = (ctx: CanvasRenderingContext2D, substrate: Substrate) => {
      // Check distance from mouse for glow effect
      const dx = substrate.x - mouseRef.current.x;
      const dy = substrate.y - mouseRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const isHovered = distance < 80;
      const hoverIntensity = isHovered ? Math.max(0, 1 - distance / 80) : 0;

      ctx.save();
      ctx.translate(substrate.x, substrate.y);
      ctx.rotate(substrate.rotation);
      const scale = substrate.scale * (isHovered ? 1.4 : 1);
      ctx.scale(scale, scale);
      ctx.globalAlpha = isDark ? substrate.alpha * 1.2 : substrate.alpha;

      const points = 6;
      const outerRadius = 10;
      const innerRadius = 5;

      // Create star path function
      const createStarPath = () => {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (i * Math.PI) / points - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
      };

      if (isHovered) {
        ctx.globalAlpha = 1;
        
        // Draw multiple glowing layers
        for (let i = 3; i >= 0; i--) {
          ctx.save();
          ctx.scale(1 + i * 0.3, 1 + i * 0.3);
          createStarPath();
          ctx.fillStyle = `rgba(253, 224, 71, ${0.4 - i * 0.1})`;
          ctx.shadowColor = "#fde047";
          ctx.shadowBlur = 40 - i * 8;
          ctx.fill();
          ctx.restore();
        }
      }

      // Main star - very bright when hovered
      createStarPath();
      
      if (isHovered) {
        ctx.shadowColor = "#fef08a";
        ctx.shadowBlur = 50;
        ctx.fillStyle = "#fef9c3"; // Very bright
      } else {
        ctx.fillStyle = isDark ? "#fcd34d" : "#fbbf24";
      }
      ctx.fill();

      // Bright center when hovered
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fffbeb";
        ctx.shadowBlur = 25;
        ctx.fill();
      }

      ctx.restore();
    };

    const drawConnections = (ctx: CanvasRenderingContext2D) => {
      const antibodies = antibodiesRef.current;
      const antigens = antigensRef.current;
      const mouse = mouseRef.current;

      // Very subtle connections between nearby antibodies and antigens
      for (const antibody of antibodies) {
        for (const antigen of antigens) {
          const dx = antibody.x - antigen.x;
          const dy = antibody.y - antigen.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120 && distance > 40) {
            // Brighter connections when mouse is near either element
            const mouseToAntibody = Math.sqrt(
              Math.pow(antibody.x - mouse.x, 2) + Math.pow(antibody.y - mouse.y, 2)
            );
            const mouseToAntigen = Math.sqrt(
              Math.pow(antigen.x - mouse.x, 2) + Math.pow(antigen.y - mouse.y, 2)
            );
            const nearMouse = mouseToAntibody < 100 || mouseToAntigen < 100;
            
            const alpha = (1 - distance / 120) * (nearMouse ? 0.4 : (isDark ? 0.15 : 0.08));
            ctx.beginPath();
            ctx.moveTo(antibody.x, antibody.y);
            ctx.lineTo(antigen.x, antigen.y);
            ctx.strokeStyle = isDark 
              ? `rgba(167, 139, 250, ${alpha})` 
              : `rgba(139, 92, 246, ${alpha})`;
            ctx.lineWidth = nearMouse ? 2 : 1;
            ctx.setLineDash([3, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
    };

    const updateElements = () => {
      if (!canvas) return;
      const width = canvas.width;
      const height = canvas.height;

      for (const antibody of antibodiesRef.current) {
        antibody.x += antibody.vx;
        antibody.y += antibody.vy;
        antibody.rotation += antibody.rotationSpeed;

        if (antibody.x < -50) antibody.x = width + 50;
        if (antibody.x > width + 50) antibody.x = -50;
        if (antibody.y < -50) antibody.y = height + 50;
        if (antibody.y > height + 50) antibody.y = -50;

        // Gentle mouse repulsion
        const dx = antibody.x - mouseRef.current.x;
        const dy = antibody.y - mouseRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 80 && distance > 0) {
          const force = (80 - distance) / 80 * 0.008;
          antibody.vx += (dx / distance) * force;
          antibody.vy += (dy / distance) * force;
        }

        // Limit velocity
        const maxVel = 0.3;
        const vel = Math.sqrt(antibody.vx * antibody.vx + antibody.vy * antibody.vy);
        if (vel > maxVel) {
          antibody.vx = (antibody.vx / vel) * maxVel;
          antibody.vy = (antibody.vy / vel) * maxVel;
        }
      }

      for (const antigen of antigensRef.current) {
        antigen.x += antigen.vx;
        antigen.y += antigen.vy;

        if (antigen.x < -20) antigen.x = width + 20;
        if (antigen.x > width + 20) antigen.x = -20;
        if (antigen.y < -20) antigen.y = height + 20;
        if (antigen.y > height + 20) antigen.y = -20;
      }

      for (const substrate of substratesRef.current) {
        substrate.x += substrate.vx;
        substrate.y += substrate.vy;
        substrate.rotation += substrate.rotationSpeed;

        if (substrate.x < -20) substrate.x = width + 20;
        if (substrate.x > width + 20) substrate.x = -20;
        if (substrate.y < -20) substrate.y = height + 20;
        if (substrate.y > height + 20) substrate.y = -20;
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections first (behind elements)
      drawConnections(ctx);

      // Draw elements
      for (const antigen of antigensRef.current) {
        drawAntigen(ctx, antigen);
      }

      for (const substrate of substratesRef.current) {
        drawSubstrate(ctx, substrate);
      }

      for (const antibody of antibodiesRef.current) {
        drawAntibody(ctx, antibody);
      }

      updateElements();

      animationRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    resizeCanvas();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 transition-colors duration-300"
      style={{ 
        background: isDark 
          ? "linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 50%, #151520 100%)" 
          : "linear-gradient(180deg, #fafbfc 0%, #f8fafc 50%, #f1f5f9 100%)" 
      }}
    />
  );
}
