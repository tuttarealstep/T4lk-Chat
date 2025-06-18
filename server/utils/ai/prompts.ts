export const titleGeneratorPrompt = `You are a title generator for a chat:
        - Generate a short title based on the first user's message
        - The title should be less than 30 characters long
        - The title should be a summary of the user's message
        - Do not use quotes (' or ") or colons (:) or any other punctuation
        - Do not use markdown, just plain text
        - Use user message language for the title`;

export const chatSystemPrompt = (preferences?: {
        name?: string
        occupation?: string
        selectedTraits?: string[]
        additionalInfo?: string
}, userInfo?: {
        timezone?: string
}) => {
        let basePrompt = `You are T4lk, an AI assistant that can answer questions and help with tasks.
Be helpful and provide relevant information.
Be respectful and polite in all interactions.
Be engaging and maintain a conversational tone.`;

        // Add current time information if timezone is available
        if (userInfo?.timezone) {
                try {
                        const currentTime = new Date().toLocaleString('en-US', {
                                timeZone: userInfo.timezone,
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZoneName: 'short'
                        });
                        basePrompt += `\n\nCurrent time in user's timezone (${userInfo.timezone}): ${currentTime}`;
                } catch (error) {
                        // Fallback if timezone is invalid
                        basePrompt += `\n\nUser timezone: ${userInfo.timezone}`;
                }
        }

        if (preferences && (preferences.name || preferences.occupation || preferences.selectedTraits?.length || preferences.additionalInfo)) {
                basePrompt += '\n\nUser Information:';

                if (preferences.name) {
                        basePrompt += `\n- Name: ${preferences.name}`;
                }

                if (preferences.occupation) {
                        basePrompt += `\n- Occupation: ${preferences.occupation}`;
                }

                if (preferences.selectedTraits && preferences.selectedTraits.length > 0) {
                        basePrompt += `\n- Personality traits: ${preferences.selectedTraits.join(', ')}`;
                }

                if (preferences.additionalInfo) {
                        basePrompt += `\n- Additional information: ${preferences.additionalInfo}`;
                }

                basePrompt += '\n\nPlease tailor your responses appropriately based on this information about the user.';
        }


        return basePrompt;
};