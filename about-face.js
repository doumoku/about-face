/**
 * About Face -- A Token Rotator
 * Rotates tokens based on the direction the token is moved
 *
 * by Eadorin, edzillion
 */

import { injectConfig } from "./scripts/injectConfig.js";
import { drawAboutFaceIndicator, onCanvasReady, onPreCreateToken, onPreUpdateToken, updateSettings } from "./scripts/logic.js";
import { MODULE_ID, registerSettings, renderSettingsConfigHandler, renderTokenConfigHandler } from "./scripts/settings.js";
import { libWrapper } from "./scripts/shim.js";

let disableAnimations,
	toggleTokenRotation = false;

Hooks.once("init", () => {
	libWrapper.register(MODULE_ID, "Token.prototype.refresh", drawAboutFaceIndicator);
	registerSettings();
	updateSettings();
	disableAnimations = game.settings.get(MODULE_ID, "disableAnimations");
	if (disableAnimations) libWrapper.register(MODULE_ID, "CanvasAnimation._animateFrame", _animateFrame, "OVERRIDE");

	game.keybindings.register(MODULE_ID, "toggleTokenRotation", {
		name: "about-face.keybindings.toggleTokenRotation.name",
		hint: "about-face.keybindings.toggleTokenRotation.hint",
		onDown: () => {
			toggleTokenRotation = !toggleTokenRotation;
			ui.notifications.notify("About Face: " + game.i18n.localize(`about-face.keybindings.toggleTokenRotation.tooltip.${toggleTokenRotation}`));
		},
		restricted: false,
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
	});
	game.keybindings.register(MODULE_ID, "lockRotation", {
		name: "about-face.keybindings.lockRotation.name",
		hint: "about-face.keybindings.lockRotation.hint",
		onDown: () => {
			for (let token of canvas.tokens.controlled) {
				var lockRotation = !token.document.lockRotation;
				token.document.update({ lockRotation: lockRotation });
			}
			ui.notifications.notify("About Face: " + game.i18n.localize(`about-face.keybindings.lockRotation.tooltip.${lockRotation}`));
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
	});
});
Hooks.on("preCreateToken", onPreCreateToken);
Hooks.on("preUpdateToken", onPreUpdateToken);

Hooks.on("canvasReady", onCanvasReady);
Hooks.on("renderSceneConfig", (app, html) => {
	const data = {
		moduleId: MODULE_ID,
		tab: {
			name: MODULE_ID,
			label: "About Face",
			icon: "fas fa-caret-down fa-fw",
		},
		sceneEnabled: {
			type: "checkbox",
			label: game.i18n.localize("about-face.sceneConfig.scene-enabled.name"),
			notes: game.i18n.localize("about-face.sceneConfig.scene-enabled.hint"),
			default: app.object?.flags?.[MODULE_ID]?.sceneEnabled ?? true,
		},
		lockRotation: {
			type: "checkbox",
			label: game.i18n.localize("about-face.sceneConfig.lockRotation.name"),
			notes: game.i18n.localize("about-face.sceneConfig.lockRotation.hint"),
			default: app.object?.flags?.[MODULE_ID]?.lockRotation ?? game.settings.get(MODULE_ID, "lockRotation"),
		},
		lockRotationButton: {
			type: "custom",
			html: `<button type="button" id="lockRotationButton">${game.i18n.localize("about-face.sceneConfig.apply")}</button>`,
		},
		lockArrowRotation: {
			type: "checkbox",
			label: game.i18n.localize("about-face.sceneConfig.lockArrowRotation.name"),
			notes: game.i18n.localize("about-face.sceneConfig.lockArrowRotation.hint"),
			default: app.object?.flags?.[MODULE_ID]?.lockArrowRotation ?? game.settings.get(MODULE_ID, "lockArrowRotation"),
		},
		lockArrowRotationButton: {
			type: "custom",
			html: `<button type="button" id="lockArrowRotationButton">${game.i18n.localize("about-face.sceneConfig.apply")}</button>`,
		},
	};
	injectConfig.inject(app, html, data, app.object);
});
Hooks.on("renderSceneConfig", async (app, html) => {
	const lockRotationButton = html.find("button[id='lockRotationButton']");
	lockRotationButton.on("click", () => {
		const lockRotationCheckbox = html.find('input[name="flags.about-face.lockRotation"]');
		const state = lockRotationCheckbox[0].checked;
		const updates = [];
		canvas.scene.tokens.forEach((token) => {
			if (token.lockRotation != state) {
				updates.push({
					_id: token.id,
					lockRotation: state,
				});
			}
		});
		canvas.scene.updateEmbeddedDocuments("Token", updates);
	});
	const lockArrowRotationButton = html.find("button[id='lockArrowRotationButton']");
	lockArrowRotationButton.on("click", () => {
		const lockArrowRotationCheckbox = html.find('input[name="flags.about-face.lockArrowRotation"]');
		const state = lockArrowRotationCheckbox[0].checked;
		const updates = [];
		canvas.scene.tokens.forEach((token) => {
			if ("token.flags.about-face.lockArrowRotation" != state) {
				updates.push({
					_id: token.id,
					flags: {
						"about-face": { lockArrowRotation: state },
					},
				});
			}
		});
		canvas.scene.updateEmbeddedDocuments("Token", updates);
	});
});
Hooks.on("renderTokenConfig", renderTokenConfigHandler);
Hooks.on("renderSettingsConfig", renderSettingsConfigHandler);

function _animateFrame(deltaTime, animation) {
	const { attributes, duration, ontick } = animation;

	// Compute animation timing and progress
	const dt = this.ticker.elapsedMS; // Delta time in MS
	animation.time += dt; // Total time which has elapsed
	const pt = animation.time / duration; // Proportion of total duration
	const complete = animation.time >= duration;
	const pa = complete ? 1 : animation.easing ? animation.easing(pt) : pt;

	// Update each attribute
	try {
		for (let a of attributes) {
			// Snap to final target
			if (
				complete ||
				(a.attribute == "rotation" && [2, 3].includes(disableAnimations)) ||
				((a.attribute == "scaleX" || a.attribute == "scaleY") && [1, 3].includes(disableAnimations))
			) {
				a.parent[a.attribute] = a.to;
				a.done = a.delta;
			}

			// Continue animating
			else {
				const da = a.delta * pa;
				a.parent[a.attribute] = a.from + da;
				a.done = da;
			}
		}

		// Callback function
		if (ontick) ontick(dt, animation);
	} catch (err) {
		// Terminate the animation if any errors occur
		animation.reject(err);
	}

	// Resolve the original promise once the animation is complete
	if (complete) animation.resolve(true);
}

function setDisableAnimations(value) {
	disableAnimations = value;
}

export { _animateFrame, setDisableAnimations, toggleTokenRotation };
