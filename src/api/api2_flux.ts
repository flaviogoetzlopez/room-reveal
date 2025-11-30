import { ProviderExoticComponent } from "react";
const apiKey = process.env.BFL_API_KEY;

async function createNewImageFromPrompt(prompt: string, input: string) {
    if (!apiKey) throw new Error("BFL_API_KEY not set");

    const input_image = input
    // fetch sends a POST with JSON body + required header
    // body contains prompt + the three input images + seed + output format
    const response = await fetch("https://api.bfl.ai/v1/flux-2-pro", {
        method: "POST",
        headers: {
            "x-key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: prompt,
            input_image: input_image,
            seed: 42,
            output_format: "jpeg",
        }),
    });

    // server returns JSON containing an "id"
    const data = await response.json();
    console.log("Request ID:", data.id);
}

