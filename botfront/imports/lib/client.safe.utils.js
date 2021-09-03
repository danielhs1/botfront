export function clearTypenameField(object) {
    const omitTypename = (key, value) => (key === '__typename' ? undefined : value);
    const cleanedObject = JSON.parse(JSON.stringify(object), omitTypename);
    return cleanedObject;
}

export const cleanPayload = (payload) => {
    const clean = clearTypenameField(payload);
    Object.keys(payload).forEach((k) => {
        if (
            ![
                'text',
                'metadata',
                'quick_replies',
                'buttons',
                'image',
                'elements',
                'attachment',
                'custom',
            ].includes(k)
        ) { delete clean[k]; }
    });
    return clean;
};

export const formNameIsValid = name => name.match(/^[a-zA-Z0-9-_]+_form$/) && name.split('form').length === 2;

export const dropNullValuesFromObject = obj => Object.entries(obj).reduce(
    (acc, [key, val]) => ({
        ...acc,
        ...(val === undefined || val === null ? {} : { [key]: val }),
    }),
    {},
);

export const insertSmartPayloads = ({ rules = [], triggerIntent, ...fragment }) => {
    if (!rules.length) return fragment;
    let payloads = rules.map(rule => ({
        intent: triggerIntent,
        entities: (rule?.trigger?.queryString || []).reduce(
            (acc, curr) => [
                ...acc,
                ...(curr.sendAsEntity ? [{ [curr.param]: curr.param }] : []),
            ],
            [],
        ),
    }));
    if (fragment.steps?.[0]?.intent) {
        payloads.unshift(fragment.steps.shift());
    } else if (fragment.steps?.[0]?.or) {
        const { or } = fragment.steps.shift();
        payloads = or.concat(payloads);
    }
    const steps = [
        payloads.length > 1 ? { or: payloads } : payloads[0],
        ...(fragment.steps || []),
    ];
    return {
        ...fragment,
        steps,
        metadata: { ...(fragment.metadata || {}), rules, triggerIntent },
    };
};

export const caught = func => async (done) => {
    try {
        await func();
        done();
    } catch (e) {
        done(e);
    }
};

export const parseTextEntities = (text = '') => {
    let parsedText = text;
    const parsedEntities = [];
    const hasEntity = /\[(.*)\]({\s*"entity"\s*:\s*".*"\s*})/;
    let charIndex = 0;

    const replaceEntities = (matchedText, entityValue, entityDataJson, relativeStart) => {
        const entityData = JSON.parse(entityDataJson);
        const entityName = entityData.entity;

        const start = relativeStart + charIndex;
        // end of the parsed string
        const end = start + entityValue.length;

        // end of the unparsed string
        const pickupAfter = start + matchedText.length;

        // if the value is a JSON, then:
        // 1. the start and end should match the start and end of the JSON
        // 2. the value should match whatever is the first value in that JSON
        // which means that the start and end will not correspond to the value
        // on the original string. that is the expected behavior.
        let parsedValue;
        try {
            [parsedValue] = Object.values(JSON.parse(entityValue));
        } catch {
            parsedValue = entityValue;
        }

        parsedEntities.push({
            start, end, entity: entityName, value: parsedValue,
        });

        let newText = `${entityValue}${matchedText.slice(pickupAfter)}`;

        if (hasEntity.test(newText)) {
            charIndex += relativeStart;
            newText = newText.replace(hasEntity, replaceEntities);
        }
        return newText;
    };

    if (text && hasEntity.test(text)) {
        parsedText = text.replace(hasEntity, replaceEntities);
    }
    return { user: parsedText, entities: parsedEntities };
};

// eslint-disable-next-line no-useless-escape
export const escapeForRegex = string => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
