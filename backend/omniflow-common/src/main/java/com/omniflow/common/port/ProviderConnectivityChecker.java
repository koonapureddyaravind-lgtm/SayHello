package com.omniflow.common.port;

import com.omniflow.common.domain.enums.Channel;

/**
 * Optional provider hook used by the integrations screen to verify that stored
 * credentials actually work. Implemented by channel modules so the integration
 * module stays free of provider-specific code.
 */
public interface ProviderConnectivityChecker {

    boolean supports(String provider, Channel channel);

    Result check(ProviderAccountInfo account);

    record Result(boolean ok, String message) {
        public static Result success(String message) {
            return new Result(true, message);
        }

        public static Result failure(String message) {
            return new Result(false, message);
        }
    }
}
